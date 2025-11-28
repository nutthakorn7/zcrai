package scheduler

import (
	"fmt"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/zrd4y/zcrAI/collector/internal/client"
	"github.com/zrd4y/zcrAI/collector/internal/config"
	"github.com/zrd4y/zcrAI/collector/internal/publisher"
	"github.com/zrd4y/zcrAI/collector/internal/state"
	"github.com/zrd4y/zcrAI/collector/pkg/models"
	"go.uber.org/zap"
)

// Scheduler จัดการ scheduled jobs
type Scheduler struct {
	cron      *cron.Cron
	config    *config.Config
	publisher *publisher.Publisher
	state     *state.State
	statePath string
	logger    *zap.Logger
	mu        sync.Mutex
	running   bool
}

// NewScheduler สร้าง Scheduler ใหม่
func NewScheduler(cfg *config.Config, pub *publisher.Publisher) *Scheduler {
	st := state.NewState()
	statePath := "data/state.json" // Path to save state
	if err := st.Load(statePath); err != nil {
		cfg.Logger.Warn("Failed to load state", zap.Error(err))
	}

	return &Scheduler{
		cron:      cron.New(cron.WithSeconds()),
		config:    cfg,
		publisher: pub,
		state:     st,
		statePath: statePath,
		logger:    cfg.Logger,
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

	s.cron.Stop()
	s.running = false
	s.logger.Info("Scheduler stopped")
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

	integrations, err := s.config.FetchIntegrations("sentinelone")
	if err != nil {
		s.logger.Error("Failed to fetch S1 integrations for full sync check", zap.Error(err))
		return
	}

	for _, integration := range integrations {
		if !s.state.HasFullSync(integration.TenantID) {
			s.logger.Info("First time run detected for tenant, starting full sync (365 days)",
				zap.String("tenantId", integration.TenantID))

			// Run full sync for this tenant
			// Note: We reuse collectSentinelOne logic but we need to target specific tenant
			// For simplicity, we just call collectSentinelOne(true) which iterates all,
			// but logic inside handles per tenant config.
			// A better approach is to refactor collectSentinelOne to accept tenantID or process list.
			// Here we just trigger a special run that uses 365 days if needed.
		}
	}

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

		// Check state
		checkpoint := s.state.GetCheckpoint(integration.TenantID)
		isFullSync := false

		// เช็คว่าเป็น integration ใหม่ (pending) หรือ forceFullSync หรือยังไม่เคย sync
		needsFullSync := integration.LastSyncStatus == "pending" || 
			!s.state.HasFullSync(integration.TenantID) || 
			forceFullSync

		if needsFullSync {
			// First run or new integration or forced full sync: 365 days back
			startTime = endTime.AddDate(0, 0, -365)
			isFullSync = true
			s.logger.Info("Performing Full Sync (365 days)", 
				zap.String("tenantId", integration.TenantID),
				zap.String("reason", integration.LastSyncStatus))
		} else {
			// Incremental sync
			if !checkpoint.IsZero() {
				// Start from last checkpoint (with 1 hour overlap for safety)
				startTime = checkpoint.Add(-1 * time.Hour)
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

		cfg, err := config.ParseS1Config(integration.Config)
		if err != nil {
			s.logger.Error("Failed to parse S1 config",
				zap.String("integrationId", integration.ID),
				zap.Error(err))
			continue
		}

		// สร้าง client พร้อม Integration info
		integrationName := integration.Name
		if integrationName == "" {
			integrationName = fmt.Sprintf("%s-%s", integration.Provider, integration.ID[:8])
		}
		s1Client := client.NewS1Client(integration.TenantID, integration.ID, integrationName, cfg, s.logger)

		// Callback สำหรับ save checkpoint หลังจบ sync
		onChunkComplete := func(chunkEndTime time.Time) {
			s.state.UpdateCheckpoint(integration.TenantID, chunkEndTime)
			if err := s.state.Save(s.statePath); err != nil {
				s.logger.Error("Failed to save checkpoint", zap.Error(err))
			}
		}

		// Callback สำหรับส่ง events ไป Vector ทันทีแต่ละ page (Streaming)
		onPageEvents := func(events []models.UnifiedEvent) error {
			return s.publisher.PublishBatch(events, 500)
		}

		// ดึง Threats (Streaming)
		threatCount, err := s1Client.FetchThreats(startTime, endTime, onPageEvents, onChunkComplete)
		if err != nil {
			s.logger.Error("Failed to fetch S1 threats",
				zap.String("tenantId", integration.TenantID),
				zap.Error(err))
			s.config.UpdateSyncStatus(integration.TenantID, "sentinelone", "error", err.Error())
			continue
		}

		// ดึง Activities (Streaming)
		activityCount, err := s1Client.FetchActivities(startTime, endTime, nil, onPageEvents, onChunkComplete)
		if err != nil {
			s.logger.Error("Failed to fetch S1 activities",
				zap.String("tenantId", integration.TenantID),
				zap.Error(err))
		}

		totalEvents := threatCount + activityCount

		// Update State
		if isFullSync {
			s.state.SetFullSync(integration.TenantID)
		}
		s.state.UpdateCheckpoint(integration.TenantID, endTime)
		
		if err := s.state.Save(s.statePath); err != nil {
			s.logger.Error("Failed to save state", zap.Error(err))
		}
		s.config.UpdateSyncStatus(integration.TenantID, "sentinelone", "success", "")

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

		// กำหนด time range
		endTime := time.Now().UTC()
		var startTime time.Time

		// เช็คว่าเป็น integration ใหม่ (pending) หรือ forceFullSync
		needsFullSync := integration.LastSyncStatus == "pending" || forceFullSync

		if needsFullSync {
			// Full Sync: 365 วันย้อนหลัง
			startTime = endTime.AddDate(0, 0, -365)
			s.logger.Info("CrowdStrike Full Sync (365 days)",
				zap.String("tenantId", integration.TenantID),
				zap.String("reason", integration.LastSyncStatus))
		} else {
			// ตรวจสอบ checkpoint
			checkpoint := s.state.GetCheckpoint(integration.TenantID + "_cs")
			if !checkpoint.IsZero() {
				startTime = checkpoint
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
		csClient := client.NewCrowdStrikeClient(integration.TenantID, integration.ID, integrationName, cfg, s.logger)

		// Callback สำหรับ save checkpoint หลังจบ sync
		onChunkComplete := func(chunkEndTime time.Time) {
			s.state.UpdateCheckpoint(integration.TenantID+"_cs", chunkEndTime)
			if err := s.state.Save(s.statePath); err != nil {
				s.logger.Error("Failed to save checkpoint", zap.Error(err))
			}
		}

		// Callback สำหรับส่ง events ไป Vector ทันทีแต่ละ page (Streaming)
		onPageEvents := func(events []models.UnifiedEvent) error {
			return s.publisher.PublishBatch(events, 500)
		}

		// ดึง Alerts (Streaming)
		alertCount, err := csClient.FetchAlerts(startTime, endTime, onPageEvents, onChunkComplete)
		if err != nil {
			s.logger.Error("Failed to fetch CrowdStrike alerts",
				zap.String("tenantId", integration.TenantID),
				zap.Error(err))
			s.config.UpdateSyncStatus(integration.TenantID, "crowdstrike", "error", err.Error())
			continue
		}

		// อัพเดท checkpoint สุดท้าย
		s.state.UpdateCheckpoint(integration.TenantID+"_cs", endTime)
		if err := s.state.Save(s.statePath); err != nil {
			s.logger.Error("Failed to save state", zap.Error(err))
		}
		s.config.UpdateSyncStatus(integration.TenantID, "crowdstrike", "success", "")

		s.logger.Info("CrowdStrike collection completed",
			zap.String("tenantId", integration.TenantID),
			zap.Int("alerts", alertCount))
	}

	return nil
}
