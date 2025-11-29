package crowdstrike

import (
	"context"
	"crypto/md5"
	"encoding/hex"
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
	baseURL         string
	clientID        string
	clientSecret    string
	tenantID        string
	integrationID   string
	integrationName string
	client          *resty.Client
	logger          *zap.Logger
	accessToken     string
	tokenExpiry     time.Time
	mu              sync.Mutex
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

// OnChunkComplete callback สำหรับอัพเดท checkpoint หลังจบแต่ละ page
type OnChunkComplete func(chunkEndTime time.Time)

// OnPageEvents callback สำหรับส่ง events ไป Vector ทันทีแต่ละ page
type OnPageEvents func(events []models.UnifiedEvent) error

// NewCrowdStrikeClient สร้าง CrowdStrike Client ใหม่
func NewCrowdStrikeClient(tenantID, integrationID, integrationName string, cfg *config.CrowdStrikeConfig, logger *zap.Logger) *CrowdStrikeClient {
	client := resty.New().
		SetTimeout(120 * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(5 * time.Second)

	return &CrowdStrikeClient{
		baseURL:         cfg.BaseURL,
		clientID:        cfg.ClientID,
		clientSecret:    cfg.ClientSecret,
		tenantID:        tenantID,
		integrationID:   integrationID,
		integrationName: integrationName,
		client:          client,
		logger:          logger,
	}
}

// GetURLHash สร้าง hash ของ baseURL + clientID (unique ต่อ integration)
func (c *CrowdStrikeClient) GetURLHash() string {
	hash := md5.Sum([]byte(c.baseURL + c.clientID))
	return hex.EncodeToString(hash[:])
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

// FetchAlerts ดึง Alerts จาก CrowdStrike Alerts API v2 แบบ Streaming
// ctx ใช้สำหรับ cancel sync เมื่อ Integration ถูกลบ
func (c *CrowdStrikeClient) FetchAlerts(ctx context.Context, startTime, endTime time.Time, onPageEvents OnPageEvents, onChunkComplete OnChunkComplete) (int, error) {
	c.logger.Info("Fetching CrowdStrike alerts with offset pagination (streaming)",
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	if err := c.authenticate(); err != nil {
		return 0, err
	}

	totalFetched := 0
	limit := 500
	maxOffset := 10000 // CrowdStrike limit
	pageDelay := 50 * time.Millisecond

	// สร้าง Filter สำหรับ full date range
	filter := fmt.Sprintf("created_timestamp:>='%s'+created_timestamp:<='%s'",
		startTime.Format(time.RFC3339),
		endTime.Format(time.RFC3339))

	// Step 1: Query all alert IDs with offset pagination
	offset := 0
	page := 1

	for {
		// ⭐ Check context ก่อนทำ request (กรณี Integration ถูกลบระหว่าง sync)
		select {
		case <-ctx.Done():
			c.logger.Warn("Context cancelled, stopping CrowdStrike alerts fetch",
				zap.String("integrationId", c.integrationID),
				zap.Int("fetchedSoFar", totalFetched),
				zap.Error(ctx.Err()))
			return totalFetched, ctx.Err()
		default:
			// continue
		}

		c.logger.Debug("Fetching alert IDs page",
			zap.Int("page", page),
			zap.Int("offset", offset))

		resp, err := c.client.R().
			SetHeader("Authorization", "Bearer "+c.accessToken).
			SetQueryParams(map[string]string{
				"filter": filter,
				"limit":  fmt.Sprintf("%d", limit),
				"offset": fmt.Sprintf("%d", offset),
				"sort":   "created_timestamp|desc",
			}).
			Get(c.baseURL + "/alerts/queries/alerts/v2")

		if err != nil {
			return totalFetched, fmt.Errorf("failed to query alerts: %w", err)
		}

		if resp.StatusCode() != 200 {
			return totalFetched, fmt.Errorf("query failed: status %d, body: %s", resp.StatusCode(), resp.String())
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
			return totalFetched, fmt.Errorf("failed to parse alert IDs: %w", err)
		}

		// ดึง alert details และส่งไป Vector ทันที (Streaming)
		if len(result.Resources) > 0 {
			alerts, err := c.getAlertDetails(result.Resources)
			if err != nil {
				c.logger.Error("Failed to get alert details", zap.Error(err))
			} else if len(alerts) > 0 {
				events := make([]models.UnifiedEvent, 0, len(alerts))
				for _, a := range alerts {
					event := c.transformAlert(a)
					events = append(events, event)
				}

				// ส่ง events ไป Vector ทันที
				if onPageEvents != nil {
					if err := onPageEvents(events); err != nil {
						c.logger.Error("Failed to publish page events", zap.Error(err))
					}
				}

				totalFetched += len(events)
			}
		}

		c.logger.Info("Fetched alert IDs page",
			zap.Int("page", page),
			zap.Int("pageCount", len(result.Resources)),
			zap.Int("totalFetched", totalFetched),
			zap.Int("totalItems", result.Meta.Pagination.Total))

		// ตรวจสอบว่ามีหน้าถัดไปหรือไม่
		if len(result.Resources) < limit || len(result.Resources) == 0 {
			c.logger.Info("Alert IDs pagination complete")
			break
		}

		offset += limit
		page++

		// CrowdStrike มี offset limit
		if offset >= maxOffset {
			c.logger.Warn("Reached CrowdStrike max offset limit", zap.Int("maxOffset", maxOffset))
			break
		}

		time.Sleep(pageDelay)
	}

	c.logger.Info("Fetched CrowdStrike alerts total", zap.Int("count", totalFetched))

	// เรียก callback หลังจบ
	if onChunkComplete != nil {
		onChunkComplete(endTime)
	}

	return totalFetched, nil
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
	// ⭐ เพิ่ม url_hash สำหรับเช็ค data completeness
	rawMap["url_hash"] = c.GetURLHash()

	return models.UnifiedEvent{
		ID:              a.CompositeID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "crowdstrike",
		Timestamp:       timestamp,
		Severity:        csSeverity(a.Severity),
		EventType:       "alert",
		Title:           a.SeverityName,
		Description:     a.PatternDisposDesc,
		MitreTactic:     a.Tactic,
		MitreTechnique:  a.Technique,
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
