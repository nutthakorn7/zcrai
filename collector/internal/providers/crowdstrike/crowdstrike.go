package crowdstrike

import (
	"context"
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
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

// CSMitreAttack โครงสร้าง MITRE ATT&CK mapping
type CSMitreAttack struct {
	PatternID   int    `json:"pattern_id"`
	Tactic      string `json:"tactic"`
	TacticID    string `json:"tactic_id"`
	Technique   string `json:"technique"`
	TechniqueID string `json:"technique_id"`
}

// CSProcessDetails โครงสร้างข้อมูล Process (parent/grandparent)
type CSProcessDetails struct {
	Cmdline        string `json:"cmdline"`
	Filename       string `json:"filename"`
	Filepath       string `json:"filepath"`
	LocalProcessID string `json:"local_process_id"`
	MD5            string `json:"md5"`
	ProcessGraphID string `json:"process_graph_id"`
	ProcessID      string `json:"process_id"`
	SHA256         string `json:"sha256"`
	Timestamp      string `json:"timestamp"`
	UserGraphID    string `json:"user_graph_id"`
	UserID         string `json:"user_id"`
	UserName       string `json:"user_name"`
}

// CSDeviceInfo โครงสร้างข้อมูล Device ใน Alert
type CSDeviceInfo struct {
	DeviceID           string   `json:"device_id"`
	CID                string   `json:"cid"`
	AgentLoadFlags     string   `json:"agent_load_flags"`
	AgentLocalTime     string   `json:"agent_local_time"`
	AgentVersion       string   `json:"agent_version"`
	ConfigIDBase       string   `json:"config_id_base"`
	ConfigIDBuild      string   `json:"config_id_build"`
	ConfigIDPlatform   string   `json:"config_id_platform"`
	ExternalIP         string   `json:"external_ip"`
	FirstSeen          string   `json:"first_seen"`
	Groups             []string `json:"groups"`
	Hostname           string   `json:"hostname"`
	LastSeen           string   `json:"last_seen"`
	LocalIP            string   `json:"local_ip"`
	MacAddress         string   `json:"mac_address"`
	MachineDomain      string   `json:"machine_domain"`
	MajorVersion       string   `json:"major_version"`
	MinorVersion       string   `json:"minor_version"`
	ModifiedTimestamp  string   `json:"modified_timestamp"`
	OsVersion          string   `json:"os_version"`
	PlatformID         string   `json:"platform_id"`
	PlatformName       string   `json:"platform_name"`
	ProductTypeDesc    string   `json:"product_type_desc"`
	Status             string   `json:"status"`
	SystemManufacturer string   `json:"system_manufacturer"`
	SystemProductName  string   `json:"system_product_name"`
	Tags               []string `json:"tags"`
}

// CSPatternDispositionDetails โครงสร้างข้อมูล Pattern Disposition
type CSPatternDispositionDetails struct {
	Detect                       bool `json:"detect"`
	KillProcess                  bool `json:"kill_process"`
	KillParent                   bool `json:"kill_parent"`
	KillSubprocess               bool `json:"kill_subprocess"`
	QuarantineFile               bool `json:"quarantine_file"`
	QuarantineMachine            bool `json:"quarantine_machine"`
	PolicyDisabled               bool `json:"policy_disabled"`
	ProcessBlocked               bool `json:"process_blocked"`
	OperationBlocked             bool `json:"operation_blocked"`
	RegistryOperationBlocked     bool `json:"registry_operation_blocked"`
	FSOperationBlocked           bool `json:"fs_operation_blocked"`
	Indicator                    bool `json:"indicator"`
	SensorOnly                   bool `json:"sensor_only"`
	Rooting                      bool `json:"rooting"`
	MFARequired                  bool `json:"mfa_required"`
	SuspendProcess               bool `json:"suspend_process"`
	SuspendParent                bool `json:"suspend_parent"`
	ResponseActionTriggered      bool `json:"response_action_triggered"`
	ResponseActionFailed         bool `json:"response_action_failed"`
	ResponseActionAlreadyApplied bool `json:"response_action_already_applied"`
}

// CSAlert โครงสร้าง Alert จาก CrowdStrike Alerts API v2 (FULL structure ตาม API จริง)
type CSAlert struct {
	// ⭐ Primary Identifiers
	CompositeID string `json:"composite_id"`
	ID          string `json:"id"`
	IndicatorID string `json:"indicator_id"`
	CID         string `json:"cid"`
	AgentID     string `json:"agent_id"`
	AggregateID string `json:"aggregate_id"`

	// ⭐ Assignment Info
	AssignedToName string `json:"assigned_to_name"`
	AssignedToUID  string `json:"assigned_to_uid"`
	AssignedToUUID string `json:"assigned_to_uuid"`

	// ⭐ Host Info (direct fields)
	Hostname      string   `json:"hostname"`
	HostNames     []string `json:"host_names"`
	SourceHosts   []string `json:"source_hosts"`
	LocalIP       string   `json:"local_ip"`
	ExternalIP    string   `json:"external_ip"`
	Platform      string   `json:"platform"`
	MachineDomain string   `json:"machine_domain"`

	// ⭐ Device Info (embedded object)
	Device CSDeviceInfo `json:"device"`

	// ⭐ User Info
	UserName      string `json:"user_name"`
	UserID        string `json:"user_id"`
	UserPrincipal string `json:"user_principal"`

	// ⭐ Status & Severity
	Status       string `json:"status"`
	Severity     int    `json:"severity"`
	SeverityName string `json:"severity_name"`
	Confidence   int    `json:"confidence"`

	// ⭐ Timestamps
	ContextTimestamp string `json:"context_timestamp"`
	CrawledTimestamp string `json:"crawled_timestamp"`
	CreatedTimestamp string `json:"created_timestamp"`
	UpdatedTimestamp string `json:"updated_timestamp"`
	Timestamp        string `json:"timestamp"`

	// ⭐ MITRE ATT&CK (primary)
	Tactic      string `json:"tactic"`
	TacticID    string `json:"tactic_id"`
	Technique   string `json:"technique"`
	TechniqueID string `json:"technique_id"`

	// ⭐ MITRE ATT&CK (array - สำหรับ multiple mappings)
	MitreAttack []CSMitreAttack `json:"mitre_attack"`

	// ⭐ Alert Details
	Name        string   `json:"name"`
	DisplayName string   `json:"display_name"`
	Description string   `json:"description"`
	Objective   string   `json:"objective"`
	DataDomains []string `json:"data_domains"`
	Tags        []string `json:"tags"`

	// ⭐ File Info
	Filename string `json:"filename"`
	Filepath string `json:"filepath"`
	Cmdline  string `json:"cmdline"`
	MD5      string `json:"md5"`
	SHA1     string `json:"sha1"`
	SHA256   string `json:"sha256"`

	// ⭐ Process Info
	ProcessID                string `json:"process_id"`
	LocalProcessID           string `json:"local_process_id"`
	ParentProcessID          string `json:"parent_process_id"`
	ProcessStartTime         string `json:"process_start_time"`
	ProcessEndTime           string `json:"process_end_time"`
	TriggeringProcessGraphID string `json:"triggering_process_graph_id"`

	// ⭐ Process Tree Details
	ParentDetails      CSProcessDetails `json:"parent_details"`
	GrandparentDetails CSProcessDetails `json:"grandparent_details"`

	// ⭐ Pattern Disposition
	PatternID            int                         `json:"pattern_id"`
	PatternDisposition   int                         `json:"pattern_disposition"`
	PatternDisposDesc    string                      `json:"pattern_disposition_description"`
	PatternDisposDetails CSPatternDispositionDetails `json:"pattern_disposition_details"`

	// ⭐ Product & Scenario
	Product        string   `json:"product"`
	Scenario       string   `json:"scenario"`
	SourceProducts []string `json:"source_products"`
	SourceVendors  []string `json:"source_vendors"`

	// ⭐ Resolution Info
	Resolution        string `json:"resolution"`
	SecondsToResolved int    `json:"seconds_to_resolved"`
	SecondsToTriaged  int    `json:"seconds_to_triaged"`

	// ⭐ Prevalence & Priority
	GlobalPrevalence string `json:"global_prevalence"`
	LocalPrevalence  string `json:"local_prevalence"`
	PriorityValue    int    `json:"priority_value"`

	// ⭐ Graph IDs & Correlation
	ControlGraphID     string `json:"control_graph_id"`
	EventCorrelationID string `json:"event_correlation_id"`
	TreeID             string `json:"tree_id"`
	TreeRoot           string `json:"tree_root"`
	TemplateInstanceID string `json:"template_instance_id"`
	PolyID             string `json:"poly_id"`

	// ⭐ Links & Additional Info
	FalconHostLink string `json:"falcon_host_link"`
	CloudIndicator string `json:"cloud_indicator"`
	IocContext     []any  `json:"ioc_context"`

	// ⭐ Additional Flags
	ShowInUI  bool   `json:"show_in_ui"`
	EmailSent bool   `json:"email_sent"`
	External  bool   `json:"external"`
	Type      string `json:"type"`
}

// ⭐ CSIncident โครงสร้าง Incident จาก CrowdStrike Incidents API (full structure)
type CSIncident struct {
	IncidentID        string           `json:"incident_id"`
	IncidentType      int              `json:"incident_type"`
	CID               string           `json:"cid"`
	HostIDs           []string         `json:"host_ids"`
	Hosts             []CSIncidentHost `json:"hosts"`
	Created           string           `json:"created"`
	Start             string           `json:"start"`
	End               string           `json:"end"`
	State             string           `json:"state"`
	Status            int              `json:"status"`
	Tactics           []string         `json:"tactics"`
	Techniques        []string         `json:"techniques"`
	Objectives        []string         `json:"objectives"`
	ModifiedTimestamp string           `json:"modified_timestamp"`
	Users             []string         `json:"users"`
	FineScore         int              `json:"fine_score"`
	AssignedToName    string           `json:"assigned_to_name"`
	AssignedToUID     string           `json:"assigned_to_uid"`
	Description       string           `json:"description"`
}

// CSIncidentHost ข้อมูล Host ใน Incident
type CSIncidentHost struct {
	DeviceID           string   `json:"device_id"`
	CID                string   `json:"cid"`
	AgentLoadFlags     string   `json:"agent_load_flags"`
	AgentLocalTime     string   `json:"agent_local_time"`
	AgentVersion       string   `json:"agent_version"`
	BiosManufacturer   string   `json:"bios_manufacturer"`
	BiosVersion        string   `json:"bios_version"`
	ConfigIDBase       string   `json:"config_id_base"`
	ConfigIDBuild      string   `json:"config_id_build"`
	ConfigIDPlatform   string   `json:"config_id_platform"`
	ExternalIP         string   `json:"external_ip"`
	Hostname           string   `json:"hostname"`
	FirstSeen          string   `json:"first_seen"`
	LastLoginTimestamp string   `json:"last_login_timestamp"`
	LastLoginUser      string   `json:"last_login_user"`
	LastSeen           string   `json:"last_seen"`
	LocalIP            string   `json:"local_ip"`
	MacAddress         string   `json:"mac_address"`
	MachineDomain      string   `json:"machine_domain"`
	MajorVersion       string   `json:"major_version"`
	MinorVersion       string   `json:"minor_version"`
	OsVersion          string   `json:"os_version"`
	OU                 []string `json:"ou"`
	PlatformID         string   `json:"platform_id"`
	PlatformName       string   `json:"platform_name"`
	ProductType        string   `json:"product_type"`
	ProductTypeDesc    string   `json:"product_type_desc"`
	SiteName           string   `json:"site_name"`
	Status             string   `json:"status"`
	SystemManufacturer string   `json:"system_manufacturer"`
	SystemProductName  string   `json:"system_product_name"`
	Tags               []string `json:"tags"`
	Groups             []string `json:"groups"`
	ModifiedTimestamp  string   `json:"modified_timestamp"`
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

	// ⭐ สร้าง Disposition Description
	disposDesc := a.PatternDisposDesc
	if disposDesc == "" {
		disposDesc = buildDispositionDesc(a.PatternDisposDetails)
	}

	// ⭐ สร้าง Response Actions
	responseActions := buildResponseActions(a.PatternDisposDetails)

	// ⭐ เลือก IP ที่ดีที่สุด
	hostIP := a.LocalIP
	if hostIP == "" && a.Device.LocalIP != "" {
		hostIP = a.Device.LocalIP
	}
	externalIP := a.ExternalIP
	if externalIP == "" && a.Device.ExternalIP != "" {
		externalIP = a.Device.ExternalIP
	}

	return models.UnifiedEvent{
		ID:              a.CompositeID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "crowdstrike",
		Timestamp:       timestamp,
		Severity:        csSeverity(a.Severity),
		EventType:       "alert",
		Title:           a.DisplayName,
		Description:     a.Description,

		// ⭐ Detection Details
		RuleName:         a.Scenario,
		ThreatName:       a.Name,
		Classification:   a.Objective,
		ConfidenceLevel:  fmt.Sprintf("%d", a.Confidence),
		IncidentStatus:   a.Status,
		DetectionEngines: a.Product,

		// ⭐ MITRE ATT&CK
		MitreTactic:    a.Tactic,
		MitreTechnique: a.Technique,

		// ⭐ Response/Disposition
		ThreatMitigated:        a.PatternDisposDetails.KillProcess || a.PatternDisposDetails.QuarantineFile,
		DispositionDescription: disposDesc,
		ResponseActions:        responseActions,

		// ⭐ Console Link
		ConsoleLink:    a.FalconHostLink,
		ControlGraphID: a.ControlGraphID,

		// ⭐ Host Info (Extended)
		Host: models.HostInfo{
			Name:         a.Hostname,
			IP:           hostIP,
			ExternalIP:   externalIP,
			MacAddress:   a.Device.MacAddress,
			OS:           a.Platform,
			OSVersion:    a.Device.OsVersion,
			Platform:     a.Device.PlatformName,
			AgentID:      a.AgentID,
			AgentVersion: a.Device.AgentVersion,
			AccountID:    a.CID,
			Domain:       a.MachineDomain,
		},
		User: models.UserInfo{
			Name:   a.UserName,
			Domain: a.MachineDomain,
		},
		Process: models.ProcessInfo{
			Name:        a.Filename,
			Path:        a.Filepath,
			CommandLine: a.Cmdline,
			MD5:         a.MD5,
			SHA256:      a.SHA256,
			SHA1:        a.SHA1,
		},
		File: models.FileInfo{
			Name:   a.Filename,
			Path:   a.Filepath,
			SHA256: a.SHA256,
			MD5:    a.MD5,
		},
		Network: models.NetworkInfo{
			SrcIP: externalIP,
		},

		// ⭐ Parent/Grandparent Process (Attack Chain)
		ParentProcess: models.ParentProcessInfo{
			Name:        a.ParentDetails.Filename,
			Path:        a.ParentDetails.Filepath,
			CommandLine: a.ParentDetails.Cmdline,
			SHA256:      a.ParentDetails.SHA256,
			MD5:         a.ParentDetails.MD5,
			UserName:    a.ParentDetails.UserName,
		},
		GrandparentProcess: models.ParentProcessInfo{
			Name:        a.GrandparentDetails.Filename,
			Path:        a.GrandparentDetails.Filepath,
			CommandLine: a.GrandparentDetails.Cmdline,
			SHA256:      a.GrandparentDetails.SHA256,
			MD5:         a.GrandparentDetails.MD5,
			UserName:    a.GrandparentDetails.UserName,
		},

		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"status":             a.Status,
			"cid":                a.CID,
			"product":            a.Product,
			"scenario":           a.Scenario,
			"confidence":         fmt.Sprintf("%d", a.Confidence),
			"objective":          a.Objective,
			"resolution":         a.Resolution,
			"assignedToName":     a.AssignedToName,
			"displayName":        a.DisplayName,
			"type":               a.Type,
			"patternId":          fmt.Sprintf("%d", a.PatternID),
			"patternDisposition": fmt.Sprintf("%d", a.PatternDisposition),
			"tacticId":           a.TacticID,
			"techniqueId":        a.TechniqueID,
			"globalPrevalence":   a.GlobalPrevalence,
			"localPrevalence":    a.LocalPrevalence,
			"priorityValue":      fmt.Sprintf("%d", a.PriorityValue),
			"controlGraphId":     a.ControlGraphID,
			"eventCorrelationId": a.EventCorrelationID,
			"falconHostLink":     a.FalconHostLink,
		},
	}
}

// buildDispositionDesc สร้างคำอธิบาย Disposition จาก details
func buildDispositionDesc(d CSPatternDispositionDetails) string {
	var actions []string
	if d.KillProcess {
		actions = append(actions, "ProcessKilled")
	}
	if d.KillParent {
		actions = append(actions, "ParentKilled")
	}
	if d.QuarantineFile {
		actions = append(actions, "FileQuarantined")
	}
	if d.QuarantineMachine {
		actions = append(actions, "MachineQuarantined")
	}
	if d.ProcessBlocked {
		actions = append(actions, "ProcessBlocked")
	}
	if d.OperationBlocked {
		actions = append(actions, "OperationBlocked")
	}
	if len(actions) == 0 {
		return "Detected"
	}
	return strings.Join(actions, ", ")
}

// buildResponseActions สร้าง response actions summary
func buildResponseActions(d CSPatternDispositionDetails) string {
	var actions []string
	if d.KillProcess {
		actions = append(actions, "kill")
	}
	if d.QuarantineFile {
		actions = append(actions, "quarantine")
	}
	if d.ProcessBlocked {
		actions = append(actions, "block")
	}
	if d.SuspendProcess {
		actions = append(actions, "suspend")
	}
	return strings.Join(actions, ",")
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

// ⭐ FetchIncidents ดึง Incidents จาก CrowdStrike Incidents API แบบ Streaming
func (c *CrowdStrikeClient) FetchIncidents(ctx context.Context, startTime, endTime time.Time, onPageEvents OnPageEvents, onChunkComplete OnChunkComplete) (int, error) {
	c.logger.Info("Fetching CrowdStrike incidents with offset pagination (streaming)",
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	if err := c.authenticate(); err != nil {
		return 0, err
	}

	totalFetched := 0
	limit := 500
	pageDelay := 50 * time.Millisecond

	// สร้าง Filter สำหรับ date range
	filter := fmt.Sprintf("start:>='%s'+start:<='%s'",
		startTime.Format(time.RFC3339),
		endTime.Format(time.RFC3339))

	offset := 0
	page := 1

	for {
		// Check context ก่อนทำ request
		select {
		case <-ctx.Done():
			c.logger.Warn("Context cancelled, stopping CrowdStrike incidents fetch",
				zap.String("integrationId", c.integrationID),
				zap.Int("fetchedSoFar", totalFetched),
				zap.Error(ctx.Err()))
			return totalFetched, ctx.Err()
		default:
		}

		c.logger.Debug("Fetching incident IDs page",
			zap.Int("page", page),
			zap.Int("offset", offset))

		resp, err := c.client.R().
			SetHeader("Authorization", "Bearer "+c.accessToken).
			SetQueryParams(map[string]string{
				"filter": filter,
				"limit":  fmt.Sprintf("%d", limit),
				"offset": fmt.Sprintf("%d", offset),
				"sort":   "start.desc",
			}).
			Get(c.baseURL + "/incidents/queries/incidents/v1")

		if err != nil {
			return totalFetched, fmt.Errorf("failed to query incidents: %w", err)
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
			return totalFetched, fmt.Errorf("failed to parse incident IDs: %w", err)
		}

		// ดึง incident details และส่งไป Vector ทันที (Streaming)
		if len(result.Resources) > 0 {
			incidents, err := c.getIncidentDetails(result.Resources)
			if err != nil {
				c.logger.Error("Failed to get incident details", zap.Error(err))
			} else if len(incidents) > 0 {
				events := make([]models.UnifiedEvent, 0, len(incidents))
				for _, inc := range incidents {
					event := c.transformIncident(inc)
					events = append(events, event)
				}

				// ส่ง events ไป Vector ทันที
				if onPageEvents != nil {
					if err := onPageEvents(events); err != nil {
						c.logger.Error("Failed to publish incident events", zap.Error(err))
					}
				}

				totalFetched += len(events)
			}
		}

		c.logger.Info("Fetched incident IDs page",
			zap.Int("page", page),
			zap.Int("pageCount", len(result.Resources)),
			zap.Int("totalFetched", totalFetched),
			zap.Int("totalItems", result.Meta.Pagination.Total))

		// ตรวจสอบว่ามีหน้าถัดไปหรือไม่
		if len(result.Resources) < limit || len(result.Resources) == 0 {
			c.logger.Info("Incident IDs pagination complete")
			break
		}

		offset += limit
		page++
		time.Sleep(pageDelay)
	}

	c.logger.Info("Fetched CrowdStrike incidents total", zap.Int("count", totalFetched))

	if onChunkComplete != nil {
		onChunkComplete(endTime)
	}

	return totalFetched, nil
}

// getIncidentDetails ดึงรายละเอียด Incidents จาก IDs
func (c *CrowdStrikeClient) getIncidentDetails(ids []string) ([]CSIncident, error) {
	resp, err := c.client.R().
		SetHeader("Authorization", "Bearer "+c.accessToken).
		SetHeader("Content-Type", "application/json").
		SetBody(map[string][]string{"ids": ids}).
		Post(c.baseURL + "/incidents/entities/incidents/GET/v1")

	if err != nil {
		return nil, fmt.Errorf("failed to get incident details: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("get details failed: status %d", resp.StatusCode())
	}

	var result struct {
		Resources []CSIncident `json:"resources"`
	}

	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return nil, fmt.Errorf("failed to parse incident details: %w", err)
	}

	return result.Resources, nil
}

// ⭐ transformIncident แปลง CSIncident เป็น UnifiedEvent (เก็บ full structure)
func (c *CrowdStrikeClient) transformIncident(inc CSIncident) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339, inc.Created)

	// เก็บ raw data ครบทั้งหมด
	raw, _ := json.Marshal(inc)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)
	rawMap["url_hash"] = c.GetURLHash()

	// severity จาก fine_score
	severity := csIncidentSeverity(inc.FineScore)

	// สร้าง title จาก tactics + techniques
	title := fmt.Sprintf("Incident: %s", strings.Join(inc.Tactics, ", "))
	if len(inc.Techniques) > 0 {
		title += fmt.Sprintf(" (%s)", strings.Join(inc.Techniques, ", "))
	}

	// description รวมข้อมูลหลัก
	description := inc.Description
	if description == "" {
		description = fmt.Sprintf("State: %s, Hosts: %d, Users: %s, Objectives: %s",
			inc.State, len(inc.Hosts), strings.Join(inc.Users, ", "), strings.Join(inc.Objectives, ", "))
	}

	// ดึงข้อมูล host แรก (ถ้ามี)
	var hostInfo models.HostInfo
	var externalIP string
	if len(inc.Hosts) > 0 {
		h := inc.Hosts[0]
		hostInfo = models.HostInfo{
			Name:         h.Hostname,
			IP:           h.LocalIP,
			ExternalIP:   h.ExternalIP,
			MacAddress:   h.MacAddress,
			OS:           h.OsVersion,
			Platform:     h.PlatformName,
			AgentID:      h.DeviceID,
			AgentVersion: h.AgentVersion,
			AccountID:    h.CID,
			SiteName:     h.SiteName,
			GroupName:    strings.Join(h.Groups, ", "),
			Domain:       h.MachineDomain,
		}
		externalIP = h.ExternalIP
	}

	// MITRE ATT&CK mapping
	mitreTactic := ""
	mitreTechnique := ""
	if len(inc.Tactics) > 0 {
		mitreTactic = inc.Tactics[0]
	}
	if len(inc.Techniques) > 0 {
		mitreTechnique = inc.Techniques[0]
	}

	// ⭐ สร้าง Console Link
	consoleLink := fmt.Sprintf("https://falcon.crowdstrike.com/incidents/incident-details/%s", inc.IncidentID)

	// ⭐ Incident Status mapping
	incidentStatus := inc.State
	if inc.Status == 20 {
		incidentStatus = "open"
	} else if inc.Status == 25 {
		incidentStatus = "reopened"
	} else if inc.Status == 30 {
		incidentStatus = "in_progress"
	} else if inc.Status == 40 {
		incidentStatus = "closed"
	}

	return models.UnifiedEvent{
		ID:              inc.IncidentID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "crowdstrike",
		Timestamp:       timestamp,
		Severity:        severity,
		EventType:       "incident",
		Title:           title,
		Description:     description,

		// ⭐ Detection Details
		Classification:  strings.Join(inc.Objectives, ", "),
		ConfidenceLevel: fmt.Sprintf("%d", inc.FineScore),
		IncidentStatus:  incidentStatus,

		// ⭐ MITRE ATT&CK
		MitreTactic:    mitreTactic,
		MitreTechnique: mitreTechnique,

		// ⭐ Console Link
		ConsoleLink: consoleLink,
		IncidentID:  inc.IncidentID,

		Host: hostInfo,
		User: models.UserInfo{
			Name: strings.Join(inc.Users, ", "),
		},
		Network: models.NetworkInfo{
			SrcIP: externalIP,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"state":      inc.State,
			"status":     fmt.Sprintf("%d", inc.Status),
			"fineScore":  fmt.Sprintf("%d", inc.FineScore),
			"hostCount":  fmt.Sprintf("%d", len(inc.Hosts)),
			"hostIds":    strings.Join(inc.HostIDs, ","),
			"cid":        inc.CID,
			"assignedTo": inc.AssignedToName,
			"tactics":    strings.Join(inc.Tactics, ","),
			"techniques": strings.Join(inc.Techniques, ","),
			"objectives": strings.Join(inc.Objectives, ","),
		},
	}
}

// csIncidentSeverity แปลง CrowdStrike fine_score เป็น severity
func csIncidentSeverity(score int) string {
	switch {
	case score >= 7:
		return "critical"
	case score >= 5:
		return "high"
	case score >= 3:
		return "medium"
	case score >= 1:
		return "low"
	default:
		return "info"
	}
}
