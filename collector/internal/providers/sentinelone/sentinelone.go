package sentinelone

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/zrd4y/zcrAI/collector/internal/config"
	"github.com/zrd4y/zcrAI/collector/pkg/models"
	"go.uber.org/zap"
)

// S1Client SentinelOne API Client
type S1Client struct {
	baseURL         string
	apiToken        string
	tenantID        string
	integrationID   string // zcrAI Integration ID
	integrationName string // ชื่อ Integration สำหรับแสดงผล
	client          *resty.Client
	logger          *zap.Logger
}

// S1Threat โครงสร้าง Threat จาก S1 API
// S1ThreatResponse โครงสร้าง Threat จาก S1 API (nested structure)
type S1ThreatResponse struct {
	AgentDetectionInfo struct {
		AccountID    string `json:"accountId"`
		AccountName  string `json:"accountName"`
		AgentDomain  string `json:"agentDomain"`
		AgentIpV4    string `json:"agentIpV4"`
		AgentOsName  string `json:"agentOsName"`
		AgentVersion string `json:"agentVersion"`
		ExternalIP   string `json:"externalIp"`
		GroupID      string `json:"groupId"`
		GroupName    string `json:"groupName"`
		SiteID       string `json:"siteId"`
		SiteName     string `json:"siteName"`
	} `json:"agentDetectionInfo"`
	AgentRealtimeInfo struct {
		AgentComputerName string `json:"agentComputerName"`
		AgentID           string `json:"agentId"`
		AgentOsType       string `json:"agentOsType"`
		AgentOsName       string `json:"agentOsName"`
		SiteName          string `json:"siteName"`
		GroupName         string `json:"groupName"`
	} `json:"agentRealtimeInfo"`
	ThreatInfo struct {
		ThreatID          string `json:"threatId"`
		ThreatName        string `json:"threatName"`
		Classification    string `json:"classification"`
		ConfidenceLevel   string `json:"confidenceLevel"`
		MitigationStatus  string `json:"mitigationStatus"`
		AnalystVerdict    string `json:"analystVerdict"`
		FilePath          string `json:"filePath"`
		FileContentHash   string `json:"sha256"`
		CreatedAt         string `json:"createdAt"`
		UpdatedAt         string `json:"updatedAt"`
		InitiatedBy       string `json:"initiatedBy"`
		OriginatorProcess string `json:"originatorProcess"`
		ProcessUser       string `json:"processUser"`
		Indicators        []struct {
			Category   string   `json:"category"`
			Ids        []int64  `json:"ids"`
			Tactics    []string `json:"tactics"`
			Techniques []string `json:"techniques"`
		} `json:"indicators"`
	} `json:"threatInfo"`
	ID string `json:"id"`
}

// S1Threat simplified for transform
type S1Threat struct {
	ID                string
	AgentID           string
	AgentComputerName string
	AgentOsName       string
	AgentOsType       string
	AgentIP           string
	AccountID         string // S1 Account ID
	AccountName       string // S1 Account Name
	SiteID            string // S1 Site ID
	SiteName          string
	GroupID           string // S1 Group ID
	GroupName         string
	Classification    string
	ConfidenceLevel   string
	ThreatName        string
	FilePath          string
	FileHash          string
	MitigationStatus  string
	AnalystVerdict    string
	MitreTactic       string
	MitreTechnique    string
	CreatedAt         string
	Username          string
	InitiatedBy       string
}

// S1Activity โครงสร้าง Activity จาก S1 API
type S1Activity struct {
	ID                   string         `json:"id"`
	ActivityType         int            `json:"activityType"`
	AgentID              string         `json:"agentId"`
	ComputerName         string         `json:"computerName"`
	SiteName             string         `json:"siteName"`
	GroupName            string         `json:"groupName"`
	AccountName          string         `json:"accountName"`
	PrimaryDescription   string         `json:"primaryDescription"`
	SecondaryDescription string         `json:"secondaryDescription"`
	UserID               string         `json:"userId"`
	CreatedAt            string         `json:"createdAt"`
	Data                 map[string]any `json:"data"`
}

// NewS1Client สร้าง S1Client ใหม่
func NewS1Client(tenantID, integrationID, integrationName string, cfg *config.S1Config, logger *zap.Logger) *S1Client {
	client := resty.New().
		SetTimeout(120 * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(5 * time.Second)

	return &S1Client{
		baseURL:         cfg.BaseURL,
		apiToken:        cfg.APIToken,
		tenantID:        tenantID,
		integrationID:   integrationID,
		integrationName: integrationName,
		client:          client,
		logger:          logger,
	}
}

// GetURLHash สร้าง hash ของ base URL สำหรับใช้เช็คว่าเป็น URL เดิมหรือไม่
func (c *S1Client) GetURLHash() string {
	hash := md5.Sum([]byte(c.baseURL))
	return hex.EncodeToString(hash[:])
}

// OnChunkComplete callback สำหรับอัพเดท checkpoint หลังจบแต่ละ page
type OnChunkComplete func(chunkEndTime time.Time)

// OnPageEvents callback สำหรับส่ง events ไป Vector ทันทีแต่ละ page
type OnPageEvents func(events []models.UnifiedEvent) error

// FetchThreats ดึง Threats จาก S1 API ใช้ Cursor Pagination แบบ Streaming
// ctx ใช้สำหรับ cancel sync เมื่อ Integration ถูกลบ
func (c *S1Client) FetchThreats(ctx context.Context, startTime, endTime time.Time, onPageEvents OnPageEvents, onChunkComplete OnChunkComplete) (int, error) {
	c.logger.Info("Fetching S1 threats with cursor pagination (streaming)",
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	totalFetched := 0
	limit := 1000
	pageDelay := 50 * time.Millisecond

	cursor := ""
	page := 1

	for {
		// ⭐ Check context ก่อนทำ request (กรณี Integration ถูกลบระหว่าง sync)
		select {
		case <-ctx.Done():
			c.logger.Warn("Context cancelled, stopping threats fetch",
				zap.String("integrationId", c.integrationID),
				zap.Int("fetchedSoFar", totalFetched),
				zap.Error(ctx.Err()))
			return totalFetched, ctx.Err()
		default:
			// continue
		}

		// สร้าง request params
		params := map[string]string{
			"limit":          fmt.Sprintf("%d", limit),
			"sortBy":         "createdAt",
			"sortOrder":      "desc",
			"createdAt__gte": startTime.Format("2006-01-02T15:04:05.000Z"),
			"createdAt__lte": endTime.Format("2006-01-02T15:04:05.000Z"),
		}
		if cursor != "" {
			params["cursor"] = cursor
		}

		c.logger.Debug("Fetching threats page",
			zap.Int("page", page),
			zap.Bool("hasCursor", cursor != ""))

		resp, err := c.client.R().
			SetHeader("Authorization", "ApiToken "+c.apiToken).
			SetQueryParams(params).
			Get(c.baseURL + "/web/api/v2.1/threats")

		if err != nil {
			return totalFetched, fmt.Errorf("failed to fetch threats: %w", err)
		}

		if resp.StatusCode() != 200 {
			return totalFetched, fmt.Errorf("S1 API error: status %d, body: %s", resp.StatusCode(), resp.String())
		}

		var result struct {
			Data       []S1ThreatResponse `json:"data"`
			Pagination struct {
				NextCursor string `json:"nextCursor"`
				TotalItems int    `json:"totalItems"`
			} `json:"pagination"`
		}

		if err := json.Unmarshal(resp.Body(), &result); err != nil {
			return totalFetched, fmt.Errorf("failed to parse threats: %w", err)
		}

		// แปลง response เป็น UnifiedEvent และส่งไป Vector ทันที
		if len(result.Data) > 0 {
			events := make([]models.UnifiedEvent, 0, len(result.Data))
			for _, r := range result.Data {
				threat := c.parseThreatResponse(r)
				event := c.transformThreat(threat)
				events = append(events, event)
			}

			// ส่ง events ไป Vector ทันที (Streaming)
			if onPageEvents != nil {
				if err := onPageEvents(events); err != nil {
					c.logger.Error("Failed to publish page events", zap.Error(err))
				}
			}

			totalFetched += len(events)
		}

		c.logger.Info("Fetched threats page",
			zap.Int("page", page),
			zap.Int("pageCount", len(result.Data)),
			zap.Int("totalFetched", totalFetched))

		// แสดง totalItems เฉพาะ page แรก
		if page == 1 && result.Pagination.TotalItems > 0 {
			c.logger.Info("S1 API reports total threats", zap.Int("totalItems", result.Pagination.TotalItems))
		}

		// ตรวจสอบว่ามีหน้าถัดไปหรือไม่
		if result.Pagination.NextCursor == "" || len(result.Data) == 0 {
			c.logger.Info("Pagination complete, no more pages")
			break
		}

		cursor = result.Pagination.NextCursor
		page++

		// delay เพื่อไม่ hit rate limit
		time.Sleep(pageDelay)
	}

	c.logger.Info("Fetched S1 threats total", zap.Int("count", totalFetched))

	// เรียก callback เมื่อ sync เสร็จสมบูรณ์เท่านั้น
	if onChunkComplete != nil {
		onChunkComplete(endTime)
	}

	return totalFetched, nil
}

// parseThreatResponse แปลง S1ThreatResponse เป็น S1Threat
func (c *S1Client) parseThreatResponse(r S1ThreatResponse) S1Threat {
	var tactic, technique string
	if len(r.ThreatInfo.Indicators) > 0 {
		ind := r.ThreatInfo.Indicators[0]
		if len(ind.Tactics) > 0 {
			tactic = ind.Tactics[0]
		}
		if len(ind.Techniques) > 0 {
			technique = ind.Techniques[0]
		}
	}

	return S1Threat{
		ID:                r.ID,
		AgentID:           r.AgentRealtimeInfo.AgentID,
		AgentComputerName: r.AgentRealtimeInfo.AgentComputerName,
		AgentOsName:       r.AgentRealtimeInfo.AgentOsName,
		AgentOsType:       r.AgentRealtimeInfo.AgentOsType,
		AgentIP:           r.AgentDetectionInfo.AgentIpV4,
		AccountID:         r.AgentDetectionInfo.AccountID,
		AccountName:       r.AgentDetectionInfo.AccountName,
		SiteID:            r.AgentDetectionInfo.SiteID,
		SiteName:          r.AgentDetectionInfo.SiteName,
		GroupID:           r.AgentDetectionInfo.GroupID,
		GroupName:         r.AgentDetectionInfo.GroupName,
		Classification:    r.ThreatInfo.Classification,
		ConfidenceLevel:   r.ThreatInfo.ConfidenceLevel,
		ThreatName:        r.ThreatInfo.ThreatName,
		FilePath:          r.ThreatInfo.FilePath,
		FileHash:          r.ThreatInfo.FileContentHash,
		MitigationStatus:  r.ThreatInfo.MitigationStatus,
		AnalystVerdict:    r.ThreatInfo.AnalystVerdict,
		MitreTactic:       tactic,
		MitreTechnique:    technique,
		CreatedAt:         r.ThreatInfo.CreatedAt,
		Username:          r.ThreatInfo.ProcessUser,
		InitiatedBy:       r.ThreatInfo.InitiatedBy,
	}
}

// transformThreat แปลง S1Threat เป็น UnifiedEvent
func (c *S1Client) transformThreat(t S1Threat) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339, t.CreatedAt)

	raw, _ := json.Marshal(t)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)
	// ⭐ เพิ่ม url_hash สำหรับเช็ค data completeness
	rawMap["url_hash"] = c.GetURLHash()

	return models.UnifiedEvent{
		ID:              t.ID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "sentinelone",
		Timestamp:       timestamp,
		Severity:        models.S1ThreatSeverity(t.ConfidenceLevel),
		EventType:       "threat",
		Title:           t.ThreatName,
		Description:     fmt.Sprintf("%s - %s", t.Classification, t.MitigationStatus),
		MitreTactic:     t.MitreTactic,
		MitreTechnique:  t.MitreTechnique,
		Host: models.HostInfo{
			Name:        t.AgentComputerName,
			IP:          t.AgentIP,
			OS:          t.AgentOsName,
			AgentID:     t.AgentID,
			AccountID:   t.AccountID,
			AccountName: t.AccountName,
			SiteID:      t.SiteID,
			SiteName:    t.SiteName,
			GroupID:     t.GroupID,
			GroupName:   t.GroupName,
		},
		User: models.UserInfo{
			Name: t.Username,
		},
		File: models.FileInfo{
			Path:   t.FilePath,
			SHA256: t.FileHash,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"mitigationStatus": t.MitigationStatus,
			"analystVerdict":   t.AnalystVerdict,
			"initiatedBy":      t.InitiatedBy,
		},
	}
}

// FetchActivities ดึง Activities จาก S1 API ใช้ Cursor Pagination แบบ Streaming
// ctx ใช้สำหรับ cancel sync เมื่อ Integration ถูกลบ
func (c *S1Client) FetchActivities(ctx context.Context, startTime, endTime time.Time, activityTypes []int, onPageEvents OnPageEvents, onChunkComplete OnChunkComplete) (int, error) {
	c.logger.Info("Fetching S1 activities with cursor pagination (streaming)",
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	totalFetched := 0
	limit := 1000
	pageDelay := 50 * time.Millisecond

	cursor := ""
	page := 1

	for {
		// ⭐ Check context ก่อนทำ request
		select {
		case <-ctx.Done():
			c.logger.Warn("Context cancelled, stopping activities fetch",
				zap.String("integrationId", c.integrationID),
				zap.Int("fetchedSoFar", totalFetched),
				zap.Error(ctx.Err()))
			return totalFetched, ctx.Err()
		default:
			// continue
		}

		// สร้าง request params
		params := map[string]string{
			"limit":          fmt.Sprintf("%d", limit),
			"sortBy":         "createdAt",
			"sortOrder":      "desc",
			"createdAt__gte": startTime.Format("2006-01-02T15:04:05.000Z"),
			"createdAt__lte": endTime.Format("2006-01-02T15:04:05.000Z"),
		}
		if cursor != "" {
			params["cursor"] = cursor
		}

		req := c.client.R().
			SetHeader("Authorization", "ApiToken "+c.apiToken).
			SetQueryParams(params)

		// ถ้ามี activity types ที่ต้องการกรอง
		if len(activityTypes) > 0 {
			typesJSON, _ := json.Marshal(activityTypes)
			req.SetQueryParam("activityTypes", string(typesJSON))
		}

		c.logger.Debug("Fetching activities page",
			zap.Int("page", page),
			zap.Bool("hasCursor", cursor != ""))

		resp, err := req.Get(c.baseURL + "/web/api/v2.1/activities")

		if err != nil {
			return totalFetched, fmt.Errorf("failed to fetch activities: %w", err)
		}

		if resp.StatusCode() != 200 {
			return totalFetched, fmt.Errorf("S1 API error: status %d, body: %s", resp.StatusCode(), resp.String())
		}

		var result struct {
			Data       []S1Activity `json:"data"`
			Pagination struct {
				NextCursor string `json:"nextCursor"`
				TotalItems int    `json:"totalItems"`
			} `json:"pagination"`
		}

		if err := json.Unmarshal(resp.Body(), &result); err != nil {
			return totalFetched, fmt.Errorf("failed to parse activities: %w", err)
		}

		// แปลง response เป็น UnifiedEvent และส่งไป Vector ทันที
		if len(result.Data) > 0 {
			events := make([]models.UnifiedEvent, 0, len(result.Data))
			for _, a := range result.Data {
				event := c.transformActivity(a)
				events = append(events, event)
			}

			// ส่ง events ไป Vector ทันที (Streaming)
			if onPageEvents != nil {
				if err := onPageEvents(events); err != nil {
					c.logger.Error("Failed to publish page events", zap.Error(err))
				}
			}

			totalFetched += len(events)
		}

		c.logger.Info("Fetched activities page",
			zap.Int("page", page),
			zap.Int("pageCount", len(result.Data)),
			zap.Int("totalFetched", totalFetched))

		// แสดง totalItems เฉพาะ page แรก
		if page == 1 && result.Pagination.TotalItems > 0 {
			c.logger.Info("S1 API reports total activities", zap.Int("totalItems", result.Pagination.TotalItems))
		}

		// ตรวจสอบว่ามีหน้าถัดไปหรือไม่
		if result.Pagination.NextCursor == "" || len(result.Data) == 0 {
			c.logger.Info("Activities pagination complete")
			break
		}

		cursor = result.Pagination.NextCursor
		page++

		// delay เพื่อไม่ hit rate limit
		time.Sleep(pageDelay)
	}

	c.logger.Info("Fetched S1 activities total", zap.Int("count", totalFetched))

	// เรียก callback เมื่อ sync เสร็จสมบูรณ์เท่านั้น
	if onChunkComplete != nil {
		onChunkComplete(endTime)
	}

	return totalFetched, nil
}

// transformActivity แปลง S1Activity เป็น UnifiedEvent
func (c *S1Client) transformActivity(a S1Activity) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339, a.CreatedAt)

	raw, _ := json.Marshal(a)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)
	// ⭐ เพิ่ม url_hash สำหรับเช็ค data completeness
	rawMap["url_hash"] = c.GetURLHash()

	return models.UnifiedEvent{
		ID:              a.ID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "sentinelone",
		Timestamp:       timestamp,
		Severity:        "info",
		EventType:       "activity",
		Title:           a.PrimaryDescription,
		Description:     a.SecondaryDescription,
		Host: models.HostInfo{
			Name:        a.ComputerName,
			AccountName: a.AccountName,
			SiteName:    a.SiteName,
			GroupName:   a.GroupName,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"activityType": fmt.Sprintf("%d", a.ActivityType),
			"accountName":  a.AccountName,
		},
	}
}
