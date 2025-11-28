package client

import (
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
	baseURL  string
	apiToken string
	tenantID string
	client   *resty.Client
	logger   *zap.Logger
}

// S1Threat โครงสร้าง Threat จาก S1 API
// S1ThreatResponse โครงสร้าง Threat จาก S1 API (nested structure)
type S1ThreatResponse struct {
	AgentDetectionInfo struct {
		AccountID           string `json:"accountId"`
		AccountName         string `json:"accountName"`
		AgentDomain         string `json:"agentDomain"`
		AgentIpV4           string `json:"agentIpV4"`
		AgentOsName         string `json:"agentOsName"`
		AgentVersion        string `json:"agentVersion"`
		ExternalIP          string `json:"externalIp"`
		GroupID             string `json:"groupId"`
		GroupName           string `json:"groupName"`
		SiteID              string `json:"siteId"`
		SiteName            string `json:"siteName"`
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
		ThreatID             string `json:"threatId"`
		ThreatName           string `json:"threatName"`
		Classification       string `json:"classification"`
		ConfidenceLevel      string `json:"confidenceLevel"`
		MitigationStatus     string `json:"mitigationStatus"`
		AnalystVerdict       string `json:"analystVerdict"`
		FilePath             string `json:"filePath"`
		FileContentHash      string `json:"sha256"`
		CreatedAt            string `json:"createdAt"`
		UpdatedAt            string `json:"updatedAt"`
		InitiatedBy          string `json:"initiatedBy"`
		OriginatorProcess    string `json:"originatorProcess"`
		ProcessUser          string `json:"processUser"`
		Indicators           []struct {
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
	SiteName          string
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
	ID            string         `json:"id"`
	ActivityType  int            `json:"activityType"`
	AgentID       string         `json:"agentId"`
	ComputerName  string         `json:"computerName"`
	SiteName      string         `json:"siteName"`
	GroupName     string         `json:"groupName"`
	AccountName   string         `json:"accountName"`
	PrimaryDescription string    `json:"primaryDescription"`
	SecondaryDescription string  `json:"secondaryDescription"`
	UserID        string         `json:"userId"`
	CreatedAt     string         `json:"createdAt"`
	Data          map[string]any `json:"data"`
}

// NewS1Client สร้าง S1Client ใหม่
func NewS1Client(tenantID string, cfg *config.S1Config, logger *zap.Logger) *S1Client {
	client := resty.New().
		SetTimeout(120 * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(5 * time.Second)

	return &S1Client{
		baseURL:  cfg.BaseURL,
		apiToken: cfg.APIToken,
		tenantID: tenantID,
		client:   client,
		logger:   logger,
	}
}

// OnChunkComplete callback สำหรับอัพเดท checkpoint หลังจบแต่ละ chunk
type OnChunkComplete func(chunkEndTime time.Time)

// FetchThreats ดึง Threats จาก S1 API (ระบุช่วงเวลา)
func (c *S1Client) FetchThreats(startTime, endTime time.Time, onChunkComplete OnChunkComplete) ([]models.UnifiedEvent, error) {
	c.logger.Info("Fetching S1 threats", 
		zap.String("tenantId", c.tenantID), 
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	var allThreats []S1Threat
	limit := 1000

	// Time Chunking Loop
	for currentStart := startTime; currentStart.Before(endTime); currentStart = currentStart.Add(24 * time.Hour) {
		currentEnd := currentStart.Add(24 * time.Hour)
		if currentEnd.After(endTime) {
			currentEnd = endTime
		}

		c.logger.Debug("Fetching threats chunk",
			zap.String("from", currentStart.Format(time.RFC3339)),
			zap.String("to", currentEnd.Format(time.RFC3339)))

		cursor := ""
		for {
			resp, err := c.client.R().
				SetHeader("Authorization", "ApiToken "+c.apiToken).
				SetQueryParams(map[string]string{
					"createdAt__gte": currentStart.Format(time.RFC3339),
					"createdAt__lt":  currentEnd.Format(time.RFC3339),
					"limit":          fmt.Sprintf("%d", limit),
					"cursor":         cursor,
				}).
				Get(c.baseURL + "/web/api/v2.1/threats")

			if err != nil {
				return nil, fmt.Errorf("failed to fetch threats: %w", err)
			}

			if resp.StatusCode() != 200 {
				return nil, fmt.Errorf("S1 API error: status %d, body: %s", resp.StatusCode(), resp.String())
			}

			var result struct {
				Data       []S1ThreatResponse `json:"data"`
				Pagination struct {
					NextCursor string `json:"nextCursor"`
				} `json:"pagination"`
			}

			if err := json.Unmarshal(resp.Body(), &result); err != nil {
				return nil, fmt.Errorf("failed to parse threats: %w", err)
			}

			// แปลง S1ThreatResponse เป็น S1Threat
			for _, r := range result.Data {
				var tactic, technique string
				if len(r.ThreatInfo.Indicators) > 0 {
					if len(r.ThreatInfo.Indicators[0].Tactics) > 0 {
						tactic = r.ThreatInfo.Indicators[0].Tactics[0]
					}
					if len(r.ThreatInfo.Indicators[0].Techniques) > 0 {
						technique = r.ThreatInfo.Indicators[0].Techniques[0]
					}
				}
				allThreats = append(allThreats, S1Threat{
					ID:                r.ID,
					AgentID:           r.AgentRealtimeInfo.AgentID,
					AgentComputerName: r.AgentRealtimeInfo.AgentComputerName,
					AgentOsName:       r.AgentRealtimeInfo.AgentOsName,
					AgentOsType:       r.AgentRealtimeInfo.AgentOsType,
					AgentIP:           r.AgentDetectionInfo.AgentIpV4,
					SiteName:          r.AgentDetectionInfo.SiteName,
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
				})
			}

			// ถ้าไม่มี next cursor แสดงว่าหมดแล้ว
			if result.Pagination.NextCursor == "" {
				break
			}
			cursor = result.Pagination.NextCursor
		}

		// เรียก callback หลังจบ chunk เพื่อ save checkpoint
		if onChunkComplete != nil {
			onChunkComplete(currentEnd)
		}
	}

	c.logger.Info("Fetched S1 threats", zap.Int("count", len(allThreats)))

	// แปลงเป็น UnifiedEvent
	events := make([]models.UnifiedEvent, 0, len(allThreats))
	for _, t := range allThreats {
		event := c.transformThreat(t)
		events = append(events, event)
	}

	return events, nil
}

// transformThreat แปลง S1Threat เป็น UnifiedEvent
func (c *S1Client) transformThreat(t S1Threat) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339, t.CreatedAt)

	raw, _ := json.Marshal(t)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)

	return models.UnifiedEvent{
		ID:             t.ID,
		TenantID:       c.tenantID,
		Source:         "sentinelone",
		Timestamp:      timestamp,
		Severity:       models.S1ThreatSeverity(t.ConfidenceLevel),
		EventType:      "threat",
		Title:          t.ThreatName,
		Description:    fmt.Sprintf("%s - %s", t.Classification, t.MitigationStatus),
		MitreTactic:    t.MitreTactic,
		MitreTechnique: t.MitreTechnique,
		Host: models.HostInfo{
			Name:      t.AgentComputerName,
			IP:        t.AgentIP,
			OS:        t.AgentOsName,
			AgentID:   t.AgentID,
			SiteName:  t.SiteName,
			GroupName: t.GroupName,
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

// FetchActivities ดึง Activities จาก S1 API (แบ่งช่วงเวลาดึงเพื่อป้องกัน Timeout)
func (c *S1Client) FetchActivities(startTime, endTime time.Time, activityTypes []int, onChunkComplete OnChunkComplete) ([]models.UnifiedEvent, error) {
	c.logger.Info("Fetching S1 activities", 
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	var allActivities []S1Activity
	limit := 1000

	// Loop แบ่งช่วงเวลาทีละ 24 ชั่วโมง (Time Chunking)
	for currentStart := startTime; currentStart.Before(endTime); currentStart = currentStart.Add(24 * time.Hour) {
		currentEnd := currentStart.Add(24 * time.Hour)
		if currentEnd.After(endTime) {
			currentEnd = endTime
		}

		c.logger.Debug("Fetching activities chunk", 
			zap.String("from", currentStart.Format(time.RFC3339)),
			zap.String("to", currentEnd.Format(time.RFC3339)))

		cursor := ""
		for {
			req := c.client.R().
				SetHeader("Authorization", "ApiToken "+c.apiToken).
				SetQueryParams(map[string]string{
					"createdAt__gte": currentStart.Format(time.RFC3339),
					"createdAt__lt":  currentEnd.Format(time.RFC3339),
					"limit":          fmt.Sprintf("%d", limit),
					"cursor":         cursor,
				})

			// ถ้ามี activity types ที่ต้องการกรอง
			if len(activityTypes) > 0 {
				typesJSON, _ := json.Marshal(activityTypes)
				req.SetQueryParam("activityTypes", string(typesJSON))
			}

			resp, err := req.Get(c.baseURL + "/web/api/v2.1/activities")

			if err != nil {
				return nil, fmt.Errorf("failed to fetch activities: %w", err)
			}

			if resp.StatusCode() != 200 {
				return nil, fmt.Errorf("S1 API error: status %d, body: %s", resp.StatusCode(), resp.String())
			}

			var result struct {
				Data       []S1Activity `json:"data"`
				Pagination struct {
					NextCursor string `json:"nextCursor"`
				} `json:"pagination"`
			}

			if err := json.Unmarshal(resp.Body(), &result); err != nil {
				return nil, fmt.Errorf("failed to parse activities: %w", err)
			}

			allActivities = append(allActivities, result.Data...)

			if result.Pagination.NextCursor == "" {
				break
			}
			cursor = result.Pagination.NextCursor
		}

		// เรียก callback หลังจบ chunk เพื่อ save checkpoint
		if onChunkComplete != nil {
			onChunkComplete(currentEnd)
		}
	}

	c.logger.Info("Fetched S1 activities", zap.Int("count", len(allActivities)))

	// แปลงเป็น UnifiedEvent
	events := make([]models.UnifiedEvent, 0, len(allActivities))
	for _, a := range allActivities {
		event := c.transformActivity(a)
		events = append(events, event)
	}

	return events, nil
}

// transformActivity แปลง S1Activity เป็น UnifiedEvent
func (c *S1Client) transformActivity(a S1Activity) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339, a.CreatedAt)

	raw, _ := json.Marshal(a)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)

	return models.UnifiedEvent{
		ID:          a.ID,
		TenantID:    c.tenantID,
		Source:      "sentinelone",
		Timestamp:   timestamp,
		Severity:    "info",
		EventType:   "activity",
		Title:       a.PrimaryDescription,
		Description: a.SecondaryDescription,
		Host: models.HostInfo{
			Name:      a.ComputerName,
			SiteName:  a.SiteName,
			GroupName: a.GroupName,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"activityType": fmt.Sprintf("%d", a.ActivityType),
			"accountName":  a.AccountName,
		},
	}
}
