package models

import "time"

// UnifiedEvent โครงสร้าง Unified Log Schema
type UnifiedEvent struct {
	ID              string    `json:"id"`
	TenantID        string    `json:"tenant_id"`
	IntegrationID   string    `json:"integration_id"`   // zcrAI Integration ID ที่เก็บ config
	IntegrationName string    `json:"integration_name"` // ชื่อ Integration สำหรับแสดงผล
	Source          string    `json:"source"`           // sentinelone, crowdstrike
	Timestamp       time.Time `json:"timestamp"`
	Severity        string    `json:"severity"` // critical, high, medium, low, info
	EventType       string    `json:"event_type"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`

	// === Detection Details (สำคัญสำหรับแสดงผล) ===
	RuleName             string `json:"rule_name,omitempty"`             // ชื่อ Rule ที่ตรวจจับ
	ThreatName           string `json:"threat_name,omitempty"`           // ชื่อ Threat/Malware
	Classification       string `json:"classification,omitempty"`        // Malware, PUP, Ransomware
	ConfidenceLevel      string `json:"confidence_level,omitempty"`      // malicious, suspicious
	AnalystVerdict       string `json:"analyst_verdict,omitempty"`       // true_positive, false_positive
	IncidentStatus       string `json:"incident_status,omitempty"`       // new, in_progress, resolved
	DetectionEngines     string `json:"detection_engines,omitempty"`     // Engine ที่ตรวจจับ
	ClassificationSource string `json:"classification_source,omitempty"` // Static, Engine, Cloud

	// === MITRE ATT&CK ===
	MitreTactic     string `json:"mitre_tactic,omitempty"`
	MitreTechnique  string `json:"mitre_technique,omitempty"`
	MitreAttackLink string `json:"mitre_attack_link,omitempty"` // Link ไป MITRE

	// === Response/Disposition ===
	ThreatMitigated        bool   `json:"threat_mitigated,omitempty"`        // ถูกจัดการแล้วหรือยัง
	DispositionDescription string `json:"disposition_description,omitempty"` // คำอธิบายการจัดการ
	ResponseActions        string `json:"response_actions,omitempty"`        // Actions ที่ทำ (quarantine, kill)

	// === Console Link ===
	ConsoleLink string `json:"console_link,omitempty"` // Link ไปดูใน Console (Falcon/S1)

	// === Storyline/Correlation ===
	Storyline      string `json:"storyline,omitempty"`        // S1 Storyline ID
	ControlGraphID string `json:"control_graph_id,omitempty"` // CS Control Graph ID
	IncidentID     string `json:"incident_id,omitempty"`      // Related Incident ID
	AlertIDs       string `json:"alert_ids,omitempty"`        // Related Alert IDs (comma-separated)

	// === Extended Host Info ===
	Host    HostInfo    `json:"host"`
	User    UserInfo    `json:"user,omitempty"`
	Process ProcessInfo `json:"process,omitempty"`
	File    FileInfo    `json:"file,omitempty"`
	Network NetworkInfo `json:"network,omitempty"`

	// === Parent/Grandparent Process (Attack Chain) ===
	ParentProcess      ParentProcessInfo `json:"parent_process,omitempty"`
	GrandparentProcess ParentProcessInfo `json:"grandparent_process,omitempty"`

	// === Raw Data ===
	URLHash     string            `json:"url_hash,omitempty"` // Hash ของ base URL ของ Provider
	Raw         map[string]any    `json:"raw"`                // Original payload
	Metadata    map[string]string `json:"metadata,omitempty"`
	CollectedAt time.Time         `json:"collected_at"`
}

// ParentProcessInfo ข้อมูล Parent/Grandparent Process สำหรับ Attack Chain
type ParentProcessInfo struct {
	Name        string `json:"name,omitempty"`
	Path        string `json:"path,omitempty"`
	CommandLine string `json:"cmd,omitempty"`
	SHA256      string `json:"sha256,omitempty"`
	MD5         string `json:"md5,omitempty"`
	UserName    string `json:"user_name,omitempty"`
}

// HostInfo ข้อมูล Host (Extended)
type HostInfo struct {
	Name         string `json:"name,omitempty"`
	IP           string `json:"ip,omitempty"`          // Internal IP
	ExternalIP   string `json:"external_ip,omitempty"` // External IP
	MacAddress   string `json:"mac_address,omitempty"` // MAC Address
	OS           string `json:"os,omitempty"`
	OSVersion    string `json:"os_version,omitempty"`
	Platform     string `json:"platform,omitempty"` // windows, linux, macos
	AgentID      string `json:"agent_id,omitempty"`
	AgentVersion string `json:"agent_version,omitempty"` // Agent Version
	AccountID    string `json:"account_id,omitempty"`    // S1 Account ID / CS CID
	AccountName  string `json:"account_name,omitempty"`  // S1 Account Name
	SiteID       string `json:"site_id,omitempty"`       // S1 Site ID
	SiteName     string `json:"site_name,omitempty"`
	GroupID      string `json:"group_id,omitempty"` // S1 Group ID / CS Host Group
	GroupName    string `json:"group_name,omitempty"`
	Domain       string `json:"domain,omitempty"` // AD Domain
	OU           string `json:"ou,omitempty"`     // AD OU
}

// UserInfo ข้อมูล User
type UserInfo struct {
	Name   string `json:"name,omitempty"`
	Domain string `json:"domain,omitempty"`
	Email  string `json:"email,omitempty"`
}

// ProcessInfo ข้อมูล Process
type ProcessInfo struct {
	Name        string `json:"name,omitempty"`
	Path        string `json:"path,omitempty"`
	CommandLine string `json:"cmd,omitempty"`
	PID         int    `json:"pid,omitempty"`
	ParentPID   int    `json:"ppid,omitempty"`
	SHA256      string `json:"sha256,omitempty"`
	SHA1        string `json:"sha1,omitempty"`
	MD5         string `json:"md5,omitempty"`
}

// FileInfo ข้อมูล File
type FileInfo struct {
	Name   string `json:"name,omitempty"`
	Path   string `json:"path,omitempty"`
	Hash   string `json:"hash,omitempty"`
	SHA256 string `json:"sha256,omitempty"`
	MD5    string `json:"md5,omitempty"`
	Size   int64  `json:"size,omitempty"`
}

// NetworkInfo ข้อมูล Network
type NetworkInfo struct {
	SrcIP     string `json:"src_ip,omitempty"`
	DstIP     string `json:"dst_ip,omitempty"`
	SrcPort   int    `json:"src_port,omitempty"`
	DstPort   int    `json:"dst_port,omitempty"`
	Protocol  string `json:"protocol,omitempty"`
	Direction string `json:"direction,omitempty"`
	BytesSent int64  `json:"bytes_sent,omitempty"`
	BytesRecv int64  `json:"bytes_recv,omitempty"`
}

// S1ThreatSeverity แปลง S1 confidence level เป็น severity
func S1ThreatSeverity(confidenceLevel string) string {
	switch confidenceLevel {
	case "malicious":
		return "critical"
	case "suspicious":
		return "high"
	case "n/a":
		return "medium"
	default:
		return "info"
	}
}

// S1ActivitySeverity แปลง S1 activity severity
func S1ActivitySeverity(severity int) string {
	switch {
	case severity >= 6:
		return "critical"
	case severity >= 4:
		return "high"
	case severity >= 2:
		return "medium"
	case severity >= 1:
		return "low"
	default:
		return "info"
	}
}
