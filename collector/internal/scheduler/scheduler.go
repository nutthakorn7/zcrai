package scheduler

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/zrd4y/zcrAI/collector/internal/clickhouse"
	"github.com/zrd4y/zcrAI/collector/internal/config"
	"github.com/zrd4y/zcrAI/collector/internal/providers/crowdstrike"
	"github.com/zrd4y/zcrAI/collector/internal/providers/sentinelone"
	"github.com/zrd4y/zcrAI/collector/internal/publisher"
	"github.com/zrd4y/zcrAI/collector/internal/state"
	"github.com/zrd4y/zcrAI/collector/pkg/models"
	"go.uber.org/zap"
)

// createURLHash สร้าง MD5 hash ของ URL สำหรับเช็คว่าเป็น URL เดิมหรือไม่
func createURLHash(url string) string {
	hash := md5.Sum([]byte(url))
	return hex.EncodeToString(hash[:])
}

// Scheduler จัดการ scheduled jobs
type Scheduler struct {
	cron       *cron.Cron
	config     *config.Config
	publisher  *publisher.Publisher
	state      *state.State
	logger     *zap.Logger
	clickhouse *clickhouse.Client // ClickHouse client สำหรับ query existing data
	mu         sync.Mutex
	running    bool
	// ⭐ Context management สำหรับ cancel sync เมื่อ Integration ถูกลบ
	syncContexts map[string]context.CancelFunc // key = integrationID
	syncMu       sync.RWMutex
}

// NewScheduler สร้าง Scheduler ใหม่
func NewScheduler(cfg *config.Config, pub *publisher.Publisher) *Scheduler {
	// สร้าง State ด้วย API URL และ Collector Key
	st := state.NewState(cfg.ElysiaURL, cfg.CollectorAPIKey)

	// สร้าง ClickHouse client สำหรับ query existing data (Best Practice: ป้องกัน duplicate)
	chClient, err := clickhouse.NewClient(clickhouse.Config{
		Host:     cfg.ClickHouseHost,
		Port:     cfg.ClickHousePort,
		Database: cfg.ClickHouseDB,
		Username: cfg.ClickHouseUser,
		Password: cfg.ClickHousePassword,
	}, cfg.Logger)
	if err != nil {
		cfg.Logger.Warn("Failed to connect to ClickHouse for existing data check", zap.Error(err))
		// ไม่ fatal - ยังทำงานได้แต่อาจมี duplicate ถ้า re-add integration
	}

	return &Scheduler{
		cron:         cron.New(cron.WithSeconds()),
		config:       cfg,
		publisher:    pub,
		state:        st,
		logger:       cfg.Logger,
		clickhouse:   chClient,
		syncContexts: make(map[string]context.CancelFunc),
	}
}

// Start เริ่ม scheduler
func (s *Scheduler) Start() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.running {
		return
	}

	// Run initial check immediately (in background)
	go s.checkAndRunFullSync()

	// Schedule SentinelOne collection ทุก 5 นาที
	s.cron.AddFunc("0 */5 * * * *", func() {
		s.collectSentinelOne(false) // Regular collection (7 days)
	})

	// Schedule CrowdStrike collection ทุก 5 นาที
	s.cron.AddFunc("0 */5 * * * *", func() {
		s.collectCrowdStrike(false)
	})

	s.cron.Start()
	s.running = true
	s.logger.Info("Scheduler started")
}

// Stop หยุด scheduler
func (s *Scheduler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.running {
		return
	}

	// Cancel all running syncs
	s.syncMu.Lock()
	for id, cancel := range s.syncContexts {
		s.logger.Info("Cancelling sync on shutdown", zap.String("integrationId", id))
		cancel()
	}
	s.syncContexts = make(map[string]context.CancelFunc)
	s.syncMu.Unlock()

	s.cron.Stop()
	s.running = false
	s.logger.Info("Scheduler stopped")
}

// CancelSync หยุด sync ของ Integration ที่ระบุ (เรียกเมื่อ Integration ถูกลบ)
func (s *Scheduler) CancelSync(integrationID string) {
	s.syncMu.Lock()
	defer s.syncMu.Unlock()

	if cancel, ok := s.syncContexts[integrationID]; ok {
		s.logger.Info("Cancelling sync for deleted integration",
			zap.String("integrationId", integrationID))
		cancel()
		delete(s.syncContexts, integrationID)
	}
}

// RunNow รัน collection ทันที
func (s *Scheduler) RunNow(source string) error {
	switch source {
	case "sentinelone":
		return s.collectSentinelOne(false)
	case "crowdstrike":
		return s.collectCrowdStrike(false)
	case "all":
		if err := s.collectSentinelOne(false); err != nil {
			s.logger.Error("S1 collection failed", zap.Error(err))
		}
		if err := s.collectCrowdStrike(false); err != nil {
			s.logger.Error("CrowdStrike collection failed", zap.Error(err))
		}
		return nil
	default:
		s.logger.Warn("Unknown source", zap.String("source", source))
		return nil
	}
}

// checkAndRunFullSync ตรวจสอบ state และรัน Full Sync ถ้าจำเป็น
func (s *Scheduler) checkAndRunFullSync() {
	s.logger.Info("Checking full sync status...")

	// ⭐ ปรับใช้ URL hash-based state - logic อยู่ใน collectSentinelOne และ collectCrowdStrike แล้ว
	// เพียงแค่ trigger collection และให้ logic ข้างในจัดการเอง

	// Trigger collection with forceFullSync=true (logic inside will check state again or force it)
	// Actually, to be precise, we should pass a map of tenants to full sync.
	// But let's simplify: collectSentinelOne(true) will use 365 days for ALL tenants.
	// Better: collectSentinelOne checks state for each tenant.

	s.collectSentinelOne(false) // Just run normal collection, but inside we check state
	s.collectCrowdStrike(false) // Same for CrowdStrike
}

// collectSentinelOne ดึงข้อมูลจาก SentinelOne ทุก tenant
func (s *Scheduler) collectSentinelOne(forceFullSync bool) error {
	s.logger.Info("Starting SentinelOne collection", zap.Bool("forceFullSync", forceFullSync))

	// ดึง integrations จาก Elysia
	integrations, err := s.config.FetchIntegrations("sentinelone")
	if err != nil {
		s.logger.Error("Failed to fetch S1 integrations", zap.Error(err))
		return err
	}

	for _, integration := range integrations {
		// Determine time range based on state
		endTime := time.Now().UTC()
		var startTime time.Time
		isFullSync := false

		// Parse config เพื่อดึง URL สำหรับสร้าง hash
		cfg, err := config.ParseS1Config(integration.Config)
		if err != nil {
			s.logger.Error("Failed to parse S1 config",
				zap.String("integrationId", integration.ID),
				zap.Error(err))
			continue
		}

		// สร้าง URL hash สำหรับเช็ค data
		urlHash := createURLHash(cfg.BaseURL)
		provider := "sentinelone"

		// Check state จาก API (PostgreSQL)
		checkpoint := s.state.GetCheckpoint(integration.TenantID, provider, urlHash)

		// เช็คว่าเป็น integration ใหม่ (pending) หรือ forceFullSync หรือยังไม่เคย sync
		needsFullSync := integration.LastSyncStatus == "pending" ||
			!s.state.HasFullSync(integration.TenantID, provider, urlHash) ||
			forceFullSync

		if needsFullSync {
			// ⭐ Option C (Best Practice): เช็คว่า URL เดิม + มี data ครบหรือไม่
			foundExisting := false
			dataComplete := false

			if s.clickhouse != nil {
				// เช็คว่ามี data จาก URL นี้หรือไม่
				existingTimestamp, count, err := s.clickhouse.GetLatestTimestampByURL(integration.TenantID, provider, urlHash)
				if err != nil {
					s.logger.Warn("Failed to check existing data by URL in ClickHouse", zap.Error(err))
				} else if !existingTimestamp.IsZero() && count > 0 {
					// มี data จาก URL เดิม → เช็คว่าครบหรือไม่
					foundExisting = true

					// เช็คว่า data ครบถ้วน (oldest event ครอบคลุม 365 วัน)
					dataComplete, _, err = s.clickhouse.CheckDataCompleteness(integration.TenantID, provider, 365)
					if err != nil {
						s.logger.Warn("Failed to check data completeness", zap.Error(err))
					}

					if dataComplete {
						// URL เดิม + data ครบ → Incremental sync จาก timestamp ล่าสุด
						startTime = existingTimestamp.Add(1 * time.Second)
						s.logger.Info("URL match + data complete → Incremental sync",
							zap.String("tenantId", integration.TenantID),
							zap.String("urlHash", urlHash),
							zap.Uint64("existingCount", count),
							zap.Time("startFrom", startTime))
					} else {
						// URL เดิม แต่ data ไม่ครบ → Full sync ใหม่ (ReplacingMergeTree จะ dedupe)
						foundExisting = false
						s.logger.Info("URL match but data incomplete → Full sync",
							zap.String("tenantId", integration.TenantID),
							zap.String("urlHash", urlHash),
							zap.Uint64("existingCount", count))
					}
				}
			}

			if !foundExisting {
				// ไม่มี data จาก URL นี้ หรือ data ไม่ครบ → Full sync 365 วัน
				startTime = endTime.AddDate(0, 0, -365)
				isFullSync = true
				s.logger.Info("Performing Full Sync (365 days)",
					zap.String("tenantId", integration.TenantID),
					zap.String("urlHash", urlHash),
					zap.String("reason", integration.LastSyncStatus))
			}
		} else {
			// Incremental sync จาก checkpoint (จาก API/PostgreSQL)
			if checkpoint != nil && !checkpoint.IsZero() {
				startTime = checkpoint.Add(1 * time.Second) // +1 sec เพื่อไม่ดึง event เดิมซ้ำ
				s.logger.Info("Resuming from checkpoint",
					zap.String("tenantId", integration.TenantID),
					zap.Time("checkpoint", startTime))
			} else {
				// Fallback to config lookback (7 days)
				startTime = endTime.AddDate(0, 0, -s.config.LookbackDays)
				s.logger.Info("No checkpoint found, using default lookback",
					zap.String("tenantId", integration.TenantID),
					zap.Int("days", s.config.LookbackDays))
			}
		}

		// สร้าง client พร้อม Integration info
		integrationName := integration.Name
		if integrationName == "" {
			integrationName = fmt.Sprintf("%s-%s", integration.Provider, integration.ID[:8])
		}
		s1Client := sentinelone.NewS1Client(integration.TenantID, integration.ID, integrationName, cfg, s.logger)

		// ⭐ สร้าง context สำหรับ cancel sync (เมื่อ Integration ถูกลบ)
		ctx, cancel := context.WithCancel(context.Background())
		s.syncMu.Lock()
		s.syncContexts[integration.ID] = cancel
		s.syncMu.Unlock()

		// Cleanup context เมื่อจบ sync
		defer func(id string) {
			s.syncMu.Lock()
			delete(s.syncContexts, id)
			s.syncMu.Unlock()
			cancel()
		}(integration.ID)

		// Capture urlHash and provider for callbacks
		currentURLHash := urlHash
		currentProvider := provider

		// Callback สำหรับ save checkpoint หลังจบ sync (ผ่าน API)
		onChunkComplete := func(chunkEndTime time.Time) {
			if err := s.state.UpdateCheckpoint(integration.TenantID, currentProvider, currentURLHash, chunkEndTime); err != nil {
				s.logger.Error("Failed to save checkpoint", zap.Error(err))
			}
		}

		// Callback สำหรับส่ง events ไป Vector ทันทีแต่ละ page (Streaming)
		onPageEvents := func(events []models.UnifiedEvent) error {
			return s.publisher.PublishBatch(events, 500)
		}

		// ⭐ ดึง FetchSettings จาก config (User สามารถ custom ได้)
		fetchSettings := cfg.FetchSettings
		if fetchSettings == nil {
			s.logger.Info("FetchSettings is nil, using defaults")
			// Default values ถ้าไม่มี fetchSettings
			fetchSettings = &config.S1FetchSettings{
				Threats:    &config.FetchSettingItem{Enabled: true, Days: 365},
				Activities: &config.FetchSettingItem{Enabled: true, Days: 120},
				Alerts:     &config.FetchSettingItem{Enabled: true, Days: 365},
			}
		} else {
			// ⭐ Log fetchSettings ที่ได้รับ
			s.logger.Info("FetchSettings from config",
				zap.Bool("threatsEnabled", fetchSettings.Threats != nil && fetchSettings.Threats.Enabled),
				zap.Int("threatsDays", func() int {
					if fetchSettings.Threats != nil {
						return fetchSettings.Threats.Days
					}
					return 0
				}()),
				zap.Bool("activitiesEnabled", fetchSettings.Activities != nil && fetchSettings.Activities.Enabled),
				zap.Int("activitiesDays", func() int {
					if fetchSettings.Activities != nil {
						return fetchSettings.Activities.Days
					}
					return 0
				}()),
			)
		}

		// ดึง Threats (ถ้า enabled)
		threatCount := 0
		if fetchSettings.Threats == nil || fetchSettings.Threats.Enabled {
			threatDays := 365
			if fetchSettings.Threats != nil {
				threatDays = fetchSettings.Threats.Days
			}

			threatStartTime := startTime
			if isFullSync {
				threatStartTime = endTime.AddDate(0, 0, -threatDays)
			}

			s.logger.Info("Fetching S1 threats",
				zap.Int("days", threatDays),
				zap.Time("from", threatStartTime))

			count, err := s1Client.FetchThreats(ctx, threatStartTime, endTime, onPageEvents, onChunkComplete)
			if err != nil {
				if ctx.Err() != nil {
					s.logger.Info("S1 threats sync cancelled", zap.String("integrationId", integration.ID))
					continue
				}
				s.logger.Error("Failed to fetch S1 threats", zap.Error(err))
				s.config.UpdateSyncStatus(integration.TenantID, "sentinelone", "error", err.Error())
				continue
			}
			threatCount = count
		} else {
			s.logger.Info("S1 Threats disabled by user settings")
		}

		// ดึง Activities (ถ้า enabled)
		activityCount := 0
		if fetchSettings.Activities == nil || fetchSettings.Activities.Enabled {
			activityDays := 120
			if fetchSettings.Activities != nil {
				activityDays = fetchSettings.Activities.Days
			}

			activityStartTime := startTime
			if isFullSync {
				activityStartTime = endTime.AddDate(0, 0, -activityDays)
			}

			s.logger.Info("Fetching S1 activities",
				zap.Int("days", activityDays),
				zap.Time("from", activityStartTime))

			count, err := s1Client.FetchActivities(ctx, activityStartTime, endTime, nil, onPageEvents, onChunkComplete)
			if err != nil {
				if ctx.Err() != nil {
					s.logger.Info("S1 activities sync cancelled", zap.String("integrationId", integration.ID))
					continue
				}
				s.logger.Error("Failed to fetch S1 activities", zap.Error(err))
			}
			activityCount = count
		} else {
			s.logger.Info("S1 Activities disabled by user settings")
		}

		totalEvents := threatCount + activityCount

		// Update State ผ่าน API (PostgreSQL)
		if isFullSync {
			if err := s.state.SetFullSync(integration.TenantID, provider, urlHash); err != nil {
				s.logger.Error("Failed to set full sync state", zap.Error(err))
			}
		}
		if err := s.state.UpdateCheckpoint(integration.TenantID, provider, urlHash, endTime); err != nil {
			s.logger.Error("Failed to save state", zap.Error(err))
		}
		s.config.UpdateSyncStatus(integration.TenantID, "sentinelone", "success", "")

		// ⭐ Event-based OPTIMIZE: dedupe ทันทีหลัง sync เสร็จ
		if totalEvents > 0 {
			s.optimizeClickHouse()
		}

		s.logger.Info("S1 collection completed",
			zap.String("tenantId", integration.TenantID),
			zap.Int("events", totalEvents))
	}

	return nil
}

// collectCrowdStrike ดึงข้อมูลจาก CrowdStrike ทุก tenant (รองรับ Full Sync + Incremental)
func (s *Scheduler) collectCrowdStrike(forceFullSync bool) error {
	s.logger.Info("Starting CrowdStrike collection", zap.Bool("forceFullSync", forceFullSync))

	// ดึง integrations จาก Elysia
	integrations, err := s.config.FetchIntegrations("crowdstrike")
	if err != nil {
		s.logger.Error("Failed to fetch CrowdStrike integrations", zap.Error(err))
		return err
	}

	for _, integration := range integrations {
		cfg, err := config.ParseCrowdStrikeConfig(integration.Config)
		if err != nil {
			s.logger.Error("Failed to parse CrowdStrike config",
				zap.String("integrationId", integration.ID),
				zap.Error(err))
			continue
		}

		// สร้าง URL hash สำหรับเช็ค data (BaseURL + ClientID = unique ต่อ integration)
		urlHash := createURLHash(cfg.BaseURL + cfg.ClientID)
		provider := "crowdstrike"

		// กำหนด time range
		endTime := time.Now().UTC()
		var startTime time.Time

		// เช็คว่าเป็น integration ใหม่ (pending) หรือ forceFullSync
		needsFullSync := integration.LastSyncStatus == "pending" || forceFullSync

		if needsFullSync {
			// ⭐ Option C (Best Practice): เช็คว่า URL เดิม + มี data ครบหรือไม่
			foundExisting := false
			dataComplete := false

			if s.clickhouse != nil {
				// เช็คว่ามี data จาก URL นี้หรือไม่
				existingTimestamp, count, err := s.clickhouse.GetLatestTimestampByURL(integration.TenantID, provider, urlHash)
				if err != nil {
					s.logger.Warn("Failed to check existing CrowdStrike data by URL in ClickHouse", zap.Error(err))
				} else if !existingTimestamp.IsZero() && count > 0 {
					// มี data จาก URL เดิม → เช็คว่าครบหรือไม่
					foundExisting = true

					dataComplete, _, err = s.clickhouse.CheckDataCompleteness(integration.TenantID, provider, 365)
					if err != nil {
						s.logger.Warn("Failed to check CrowdStrike data completeness", zap.Error(err))
					}

					if dataComplete {
						// URL เดิม + data ครบ → Incremental sync
						startTime = existingTimestamp.Add(1 * time.Second)
						s.logger.Info("CrowdStrike: URL match + data complete → Incremental sync",
							zap.String("tenantId", integration.TenantID),
							zap.String("urlHash", urlHash),
							zap.Uint64("existingCount", count),
							zap.Time("startFrom", startTime))
					} else {
						// URL เดิม แต่ data ไม่ครบ → Full sync
						foundExisting = false
						s.logger.Info("CrowdStrike: URL match but data incomplete → Full sync",
							zap.String("tenantId", integration.TenantID),
							zap.String("urlHash", urlHash),
							zap.Uint64("existingCount", count))
					}
				}
			}

			if !foundExisting {
				// ไม่มี data จาก URL นี้ หรือ data ไม่ครบ → Full sync 365 วัน
				startTime = endTime.AddDate(0, 0, -365)
				s.logger.Info("CrowdStrike Full Sync (365 days)",
					zap.String("tenantId", integration.TenantID),
					zap.String("urlHash", urlHash),
					zap.String("reason", integration.LastSyncStatus))
			}
		} else {
			// ตรวจสอบ checkpoint จาก API (PostgreSQL)
			checkpoint := s.state.GetCheckpoint(integration.TenantID, provider, urlHash)
			if checkpoint != nil && !checkpoint.IsZero() {
				startTime = checkpoint.Add(1 * time.Second) // +1 sec เพื่อไม่ดึง event เดิมซ้ำ
			} else {
				startTime = endTime.AddDate(0, 0, -s.config.LookbackDays)
			}
		}

		s.logger.Info("CrowdStrike time range",
			zap.String("tenantId", integration.TenantID),
			zap.Time("from", startTime),
			zap.Time("to", endTime))

		// สร้าง client พร้อม Integration info
		integrationName := integration.Name
		if integrationName == "" {
			integrationName = fmt.Sprintf("%s-%s", integration.Provider, integration.ID[:8])
		}
		csClient := crowdstrike.NewCrowdStrikeClient(integration.TenantID, integration.ID, integrationName, cfg, s.logger)

		// ⭐ สร้าง context สำหรับ cancel sync (เมื่อ Integration ถูกลบ)
		ctx, cancel := context.WithCancel(context.Background())
		s.syncMu.Lock()
		s.syncContexts[integration.ID] = cancel
		s.syncMu.Unlock()

		// Cleanup context เมื่อจบ sync
		defer func(id string) {
			s.syncMu.Lock()
			delete(s.syncContexts, id)
			s.syncMu.Unlock()
			cancel()
		}(integration.ID)

		// Capture urlHash and provider for callbacks
		currentURLHash := urlHash
		currentProvider := provider

		// Callback สำหรับ save checkpoint หลังจบ sync (ผ่าน API)
		onChunkComplete := func(chunkEndTime time.Time) {
			if err := s.state.UpdateCheckpoint(integration.TenantID, currentProvider, currentURLHash, chunkEndTime); err != nil {
				s.logger.Error("Failed to save checkpoint", zap.Error(err))
			}
		}

		// Callback สำหรับส่ง events ไป Vector ทันทีแต่ละ page (Streaming)
		onPageEvents := func(events []models.UnifiedEvent) error {
			return s.publisher.PublishBatch(events, 500)
		}

		// ⭐ ดึง FetchSettings จาก config (User สามารถ custom ได้)
		csFetchSettings := cfg.FetchSettings
		if csFetchSettings == nil {
			// Default values ถ้าไม่มี fetchSettings
			csFetchSettings = &config.CSFetchSettings{
				Alerts:     &config.FetchSettingItem{Enabled: true, Days: 365},
				Detections: &config.FetchSettingItem{Enabled: true, Days: 365},
				Incidents:  &config.FetchSettingItem{Enabled: true, Days: 365},
			}
		}

		// ดึง Alerts (ถ้า enabled)
		alertCount := 0
		if csFetchSettings.Alerts == nil || csFetchSettings.Alerts.Enabled {
			alertDays := 365
			if csFetchSettings.Alerts != nil {
				alertDays = csFetchSettings.Alerts.Days
			}

			alertStartTime := startTime
			if needsFullSync {
				alertStartTime = endTime.AddDate(0, 0, -alertDays)
			}

			s.logger.Info("Fetching CrowdStrike alerts",
				zap.Int("days", alertDays),
				zap.Time("from", alertStartTime))

			count, err := csClient.FetchAlerts(ctx, alertStartTime, endTime, onPageEvents, onChunkComplete)
			if err != nil {
				if ctx.Err() != nil {
					s.logger.Info("CrowdStrike alerts sync cancelled", zap.String("integrationId", integration.ID))
					continue
				}
				s.logger.Error("Failed to fetch CrowdStrike alerts", zap.Error(err))
				s.config.UpdateSyncStatus(integration.TenantID, "crowdstrike", "error", err.Error())
				continue
			}
			alertCount = count
		} else {
			s.logger.Info("CrowdStrike Alerts disabled by user settings")
		}

		// อัพเดท checkpoint สุดท้ายผ่าน API
		if err := s.state.UpdateCheckpoint(integration.TenantID, provider, urlHash, endTime); err != nil {
			s.logger.Error("Failed to save state", zap.Error(err))
		}
		s.config.UpdateSyncStatus(integration.TenantID, "crowdstrike", "success", "")

		// ⭐ Event-based OPTIMIZE: dedupe ทันทีหลัง sync เสร็จ
		if alertCount > 0 {
			s.optimizeClickHouse()
		}

		s.logger.Info("CrowdStrike collection completed",
			zap.String("tenantId", integration.TenantID),
			zap.Int("alerts", alertCount))
	}

	return nil
}

// optimizeClickHouse รัน OPTIMIZE TABLE เพื่อ dedupe ข้อมูลซ้ำ (Event-based)
func (s *Scheduler) optimizeClickHouse() {
	if s.clickhouse == nil {
		return
	}
	s.logger.Info("Running OPTIMIZE TABLE for deduplication (Event-based)")
	if err := s.clickhouse.OptimizeTable("zcrai.security_events"); err != nil {
		s.logger.Error("Failed to optimize security_events", zap.Error(err))
	}
}
