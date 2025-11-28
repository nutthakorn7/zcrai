package client

import (
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/zrd4y/zcrAI/collector/internal/config"
	"github.com/zrd4y/zcrAI/collector/pkg/models"
	"go.uber.org/zap"
)

// CrowdStrikeClient CrowdStrike Falcon API Client
type CrowdStrikeClient struct {
	baseURL      string
	clientID     string
	clientSecret string
	tenantID     string
	client       *resty.Client
	logger       *zap.Logger
	accessToken  string
	tokenExpiry  time.Time
	mu           sync.Mutex
}

// CSAlert โครงสร้าง Alert จาก CrowdStrike Alerts API v2
type CSAlert struct {
	CompositeID       string `json:"composite_id"`
	CID               string `json:"cid"`
	AgentID           string `json:"agent_id"`
	Hostname          string `json:"hostname"`
	LocalIP           string `json:"local_ip"`
	ExternalIP        string `json:"external_ip"`
	Platform          string `json:"platform"`
	MachineDomain     string `json:"machine_domain"`
	UserName          string `json:"user_name"`
	Status            string `json:"status"`
	Severity          int    `json:"severity"`
	SeverityName      string `json:"severity_name"`
	Confidence        int    `json:"confidence"`
	CreatedTimestamp  string `json:"created_timestamp"`
	UpdatedTimestamp  string `json:"updated_timestamp"`
	Timestamp         string `json:"timestamp"`
	Tactic            string `json:"tactic"`
	TacticID          string `json:"tactic_id"`
	Technique         string `json:"technique"`
	TechniqueID       string `json:"technique_id"`
	Description       string `json:"description"`
	Filename          string `json:"filename"`
	Filepath          string `json:"filepath"`
	Cmdline           string `json:"cmdline"`
	SHA256            string `json:"sha256"`
	Product           string `json:"product"`
	Scenario          string `json:"scenario"`
	PatternDisposDesc string `json:"pattern_disposition_description"`
}

// NewCrowdStrikeClient สร้าง CrowdStrike Client ใหม่
func NewCrowdStrikeClient(tenantID string, cfg *config.CrowdStrikeConfig, logger *zap.Logger) *CrowdStrikeClient {
	client := resty.New().
		SetTimeout(120 * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(5 * time.Second)

	return &CrowdStrikeClient{
		baseURL:      cfg.BaseURL,
		clientID:     cfg.ClientID,
		clientSecret: cfg.ClientSecret,
		tenantID:     tenantID,
		client:       client,
		logger:       logger,
	}
}

// authenticate ขอ OAuth2 token จาก CrowdStrike
func (c *CrowdStrikeClient) authenticate() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	// ถ้า token ยังไม่หมดอายุ ไม่ต้องขอใหม่
	if c.accessToken != "" && time.Now().Before(c.tokenExpiry) {
		return nil
	}

	resp, err := c.client.R().
		SetHeader("Content-Type", "application/x-www-form-urlencoded").
		SetFormData(map[string]string{
			"client_id":     c.clientID,
			"client_secret": c.clientSecret,
		}).
		Post(c.baseURL + "/oauth2/token")

	if err != nil {
		return fmt.Errorf("failed to authenticate: %w", err)
	}

	if resp.StatusCode() != 201 {
		return fmt.Errorf("authentication failed: status %d, body: %s", resp.StatusCode(), resp.String())
	}

	var result struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}

	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return fmt.Errorf("failed to parse token response: %w", err)
	}

	c.accessToken = result.AccessToken
	c.tokenExpiry = time.Now().Add(time.Duration(result.ExpiresIn-60) * time.Second) // 60 วินาที buffer

	c.logger.Debug("CrowdStrike authenticated", zap.Time("expiry", c.tokenExpiry))
	return nil
}

// FetchAlerts ดึง Alerts จาก CrowdStrike Alerts API v2 (ระบุช่วงเวลา + Time Chunking)
func (c *CrowdStrikeClient) FetchAlerts(startTime, endTime time.Time, onChunkComplete OnChunkComplete) ([]models.UnifiedEvent, error) {
	c.logger.Info("Fetching CrowdStrike alerts", 
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	if err := c.authenticate(); err != nil {
		return nil, err
	}

	var allAlerts []CSAlert
	limit := 500

	// Time Chunking Loop (ทีละ 24 ชั่วโมง)
	for currentStart := startTime; currentStart.Before(endTime); currentStart = currentStart.Add(24 * time.Hour) {
		currentEnd := currentStart.Add(24 * time.Hour)
		if currentEnd.After(endTime) {
			currentEnd = endTime
		}

		c.logger.Debug("Fetching alerts chunk",
			zap.String("from", currentStart.Format(time.RFC3339)),
			zap.String("to", currentEnd.Format(time.RFC3339)))

		// Query alert IDs for this chunk (ใช้ Alerts API v2)
		var chunkAlertIDs []string
		offset := 0

		for {
			// Filter format สำหรับ Alerts API
			filter := fmt.Sprintf("created_timestamp:>='%s'+created_timestamp:<'%s'",
				currentStart.Format(time.RFC3339),
				currentEnd.Format(time.RFC3339))

			resp, err := c.client.R().
				SetHeader("Authorization", "Bearer "+c.accessToken).
				SetQueryParams(map[string]string{
					"filter": filter,
					"limit":  fmt.Sprintf("%d", limit),
					"offset": fmt.Sprintf("%d", offset),
				}).
				Get(c.baseURL + "/alerts/queries/alerts/v2")

			if err != nil {
				return nil, fmt.Errorf("failed to query alerts: %w", err)
			}

			if resp.StatusCode() != 200 {
				return nil, fmt.Errorf("query failed: status %d, body: %s", resp.StatusCode(), resp.String())
			}

			var result struct {
				Resources []string `json:"resources"`
				Meta      struct {
					Pagination struct {
						Total  int `json:"total"`
						Offset int `json:"offset"`
					} `json:"pagination"`
				} `json:"meta"`
			}

			if err := json.Unmarshal(resp.Body(), &result); err != nil {
				return nil, fmt.Errorf("failed to parse alert IDs: %w", err)
			}

			chunkAlertIDs = append(chunkAlertIDs, result.Resources...)

			if len(result.Resources) < limit {
				break
			}
			offset += limit
		}

		// Get alert details (batch 100) ใช้ POST /alerts/entities/alerts/v2
		batchSize := 100
		for i := 0; i < len(chunkAlertIDs); i += batchSize {
			end := i + batchSize
			if end > len(chunkAlertIDs) {
				end = len(chunkAlertIDs)
			}

			batch := chunkAlertIDs[i:end]
			alerts, err := c.getAlertDetails(batch)
			if err != nil {
				c.logger.Error("Failed to get alert details", zap.Error(err))
				continue
			}
			allAlerts = append(allAlerts, alerts...)
		}

		// เรียก callback หลังจบ chunk เพื่อ save checkpoint
		if onChunkComplete != nil {
			onChunkComplete(currentEnd)
		}
	}

	c.logger.Info("Fetched CrowdStrike alerts", zap.Int("count", len(allAlerts)))

	// แปลงเป็น UnifiedEvent
	events := make([]models.UnifiedEvent, 0, len(allAlerts))
	for _, a := range allAlerts {
		event := c.transformAlert(a)
		events = append(events, event)
	}

	return events, nil
}

// getAlertDetails ดึงรายละเอียด alert จาก composite_ids (ใช้ Alerts API v2)
func (c *CrowdStrikeClient) getAlertDetails(ids []string) ([]CSAlert, error) {
	if err := c.authenticate(); err != nil {
		return nil, err
	}

	resp, err := c.client.R().
		SetHeader("Authorization", "Bearer "+c.accessToken).
		SetHeader("Content-Type", "application/json").
		SetBody(map[string][]string{"composite_ids": ids}).
		Post(c.baseURL + "/alerts/entities/alerts/v2")

	if err != nil {
		return nil, fmt.Errorf("failed to get alert details: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("get details failed: status %d, body: %s", resp.StatusCode(), resp.String())
	}

	var result struct {
		Resources []CSAlert `json:"resources"`
	}

	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return nil, fmt.Errorf("failed to parse alert details: %w", err)
	}

	return result.Resources, nil
}

// transformAlert แปลง CSAlert เป็น UnifiedEvent (Alerts API v2)
func (c *CrowdStrikeClient) transformAlert(a CSAlert) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339Nano, a.Timestamp)
	if timestamp.IsZero() {
		timestamp, _ = time.Parse(time.RFC3339Nano, a.CreatedTimestamp)
	}

	raw, _ := json.Marshal(a)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)

	return models.UnifiedEvent{
		ID:             a.CompositeID,
		TenantID:       c.tenantID,
		Source:         "crowdstrike",
		Timestamp:      timestamp,
		Severity:       csSeverity(a.Severity),
		EventType:      "alert",
		Title:          a.SeverityName,
		Description:    a.PatternDisposDesc,
		MitreTactic:    a.Tactic,
		MitreTechnique: a.Technique,
		Host: models.HostInfo{
			Name:    a.Hostname,
			IP:      a.LocalIP,
			OS:      a.Platform,
			AgentID: a.AgentID,
		},
		User: models.UserInfo{
			Name:   a.UserName,
			Domain: a.MachineDomain,
		},
		Process: models.ProcessInfo{
			Name:        a.Filename,
			Path:        a.Filepath,
			CommandLine: a.Cmdline,
			SHA256:      a.SHA256,
		},
		File: models.FileInfo{
			Name:   a.Filename,
			Path:   a.Filepath,
			SHA256: a.SHA256,
		},
		Network: models.NetworkInfo{
			SrcIP: a.ExternalIP,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"status":     a.Status,
			"cid":        a.CID,
			"product":    a.Product,
			"scenario":   a.Scenario,
			"confidence": fmt.Sprintf("%d", a.Confidence),
		},
	}
}

// csSeverity แปลง CrowdStrike severity score เป็น string
func csSeverity(score int) string {
	switch {
	case score >= 80:
		return "critical"
	case score >= 60:
		return "high"
	case score >= 40:
		return "medium"
	case score >= 20:
		return "low"
	default:
		return "info"
	}
}
