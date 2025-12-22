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

// S1ThreatResponse โครงสร้าง Threat จาก S1 API (FULL structure ตาม API response จริง)
type S1ThreatResponse struct {
	ID string `json:"id"`
	// ⭐ AgentDetectionInfo - ข้อมูล Agent ณ เวลาที่ตรวจพบ Threat
	AgentDetectionInfo struct {
		AccountID                 string `json:"accountId"`
		AccountName               string `json:"accountName"`
		AgentDetectionState       string `json:"agentDetectionState"`
		AgentDomain               string `json:"agentDomain"`
		AgentIpV4                 string `json:"agentIpV4"`
		AgentIpV6                 string `json:"agentIpV6"`
		AgentLastLoggedInUpn      string `json:"agentLastLoggedInUpn"`
		AgentLastLoggedInUserMail string `json:"agentLastLoggedInUserMail"`
		AgentLastLoggedInUserName string `json:"agentLastLoggedInUserName"`
		AgentMitigationMode       string `json:"agentMitigationMode"`
		AgentOsName               string `json:"agentOsName"`
		AgentOsRevision           string `json:"agentOsRevision"`
		AgentRegisteredAt         string `json:"agentRegisteredAt"`
		AgentUuid                 string `json:"agentUuid"`
		AgentVersion              string `json:"agentVersion"`
		CloudProviders            any    `json:"cloudProviders"`
		ExternalIP                string `json:"externalIp"`
		GroupID                   string `json:"groupId"`
		GroupName                 string `json:"groupName"`
		SiteID                    string `json:"siteId"`
		SiteName                  string `json:"siteName"`
	} `json:"agentDetectionInfo"`
	// ⭐ AgentRealtimeInfo - ข้อมูล Agent ปัจจุบัน
	AgentRealtimeInfo struct {
		ActiveThreats         int    `json:"activeThreats"`
		AgentComputerName     string `json:"agentComputerName"`
		AgentDecommissionedAt any    `json:"agentDecommissionedAt"` // อาจเป็น bool หรือ string
		AgentDomain           string `json:"agentDomain"`
		AgentID               string `json:"agentId"`
		AgentInfected         bool   `json:"agentInfected"`
		AgentIsActive         bool   `json:"agentIsActive"`
		AgentIsDecommissioned bool   `json:"agentIsDecommissioned"`
		AgentMachineType      string `json:"agentMachineType"`
		AgentMitigationMode   string `json:"agentMitigationMode"`
		AgentNetworkStatus    string `json:"agentNetworkStatus"`
		AgentOsName           string `json:"agentOsName"`
		AgentOsRevision       string `json:"agentOsRevision"`
		AgentOsType           string `json:"agentOsType"`
		AgentUuid             string `json:"agentUuid"`
		AgentVersion          string `json:"agentVersion"`
		GroupID               string `json:"groupId"`
		GroupName             string `json:"groupName"`
		NetworkInterfaces     []struct {
			ID         string   `json:"id"`
			Inet       []string `json:"inet"`
			Inet6      []string `json:"inet6"`
			Name       string   `json:"name"`
			Physical   string   `json:"physical"`
			GatewayIP  string   `json:"gatewayIp"`
			GatewayMAC string   `json:"gatewayMacAddress"`
		} `json:"networkInterfaces"`
		OperationalState  string   `json:"operationalState"`
		RebootRequired    bool     `json:"rebootRequired"`
		ScanAbortedAt     any      `json:"scanAbortedAt"`  // อาจเป็น bool หรือ string
		ScanFinishedAt    any      `json:"scanFinishedAt"` // อาจเป็น bool หรือ string
		ScanStartedAt     any      `json:"scanStartedAt"`  // อาจเป็น bool หรือ string
		ScanStatus        string   `json:"scanStatus"`
		SiteID            string   `json:"siteId"`
		SiteName          string   `json:"siteName"`
		StorageName       string   `json:"storageName"`
		StorageType       string   `json:"storageType"`
		UserActionsNeeded []string `json:"userActionsNeeded"`
	} `json:"agentRealtimeInfo"`
	// ⭐ ThreatInfo - ข้อมูล Threat ทั้งหมด
	ThreatInfo struct {
		AnalystVerdict            string `json:"analystVerdict"`
		AnalystVerdictDescription string `json:"analystVerdictDescription"`
		AutomaticallyResolved     bool   `json:"automaticallyResolved"`
		BrowserType               string `json:"browserType"`
		CertificateID             string `json:"certificateId"`
		Classification            string `json:"classification"`
		ClassificationSource      string `json:"classificationSource"`
		CloudFilesHashVerdict     string `json:"cloudFilesHashVerdict"`
		CollectionID              string `json:"collectionId"`
		ConfidenceLevel           string `json:"confidenceLevel"`
		CreatedAt                 string `json:"createdAt"`
		DetectionEngines          []struct {
			Key   string `json:"key"`
			Title string `json:"title"`
		} `json:"detectionEngines"`
		DetectionType             string   `json:"detectionType"`
		Engines                   []string `json:"engines"`
		ExternalTicketExists      bool     `json:"externalTicketExists"`
		ExternalTicketID          string   `json:"externalTicketId"`
		FailedActions             bool     `json:"failedActions"`
		FileExtension             string   `json:"fileExtension"`
		FileExtensionType         string   `json:"fileExtensionType"`
		FilePath                  string   `json:"filePath"`
		FileSize                  int64    `json:"fileSize"`
		FileVerificationType      string   `json:"fileVerificationType"`
		IdentifiedAt              string   `json:"identifiedAt"`
		IncidentStatus            string   `json:"incidentStatus"`
		IncidentStatusDescription string   `json:"incidentStatusDescription"`
		Indicators                []struct {
			Category    string  `json:"category"`
			Description string  `json:"description"`
			IDs         []int64 `json:"ids"`
			Tactics     []struct {
				Name   string `json:"name"`
				Source string `json:"source"`
			} `json:"tactics"`
			Techniques []struct {
				Link   string `json:"link"`
				Name   string `json:"name"`
				Source string `json:"source"`
			} `json:"techniques"`
		} `json:"indicators"`
		InitiatedBy                 string `json:"initiatedBy"`
		InitiatedByDescription      string `json:"initiatedByDescription"`
		IsFileless                  bool   `json:"isFileless"`
		IsValidCertificate          bool   `json:"isValidCertificate"`
		MaliciousProcessArguments   string `json:"maliciousProcessArguments"`
		Md5                         string `json:"md5"`
		MitigatedPreemptively       bool   `json:"mitigatedPreemptively"`
		MitigationStatus            string `json:"mitigationStatus"`
		MitigationStatusDescription string `json:"mitigationStatusDescription"`
		OriginatorProcess           string `json:"originatorProcess"`
		PendingActions              bool   `json:"pendingActions"`
		ProcessUser                 string `json:"processUser"`
		PublisherName               string `json:"publisherName"`
		ReachedEventsLimit          bool   `json:"reachedEventsLimit"`
		RebootRequired              bool   `json:"rebootRequired"`
		Sha1                        string `json:"sha1"`
		Sha256                      string `json:"sha256"`
		Storyline                   string `json:"storyline"`
		ThreatID                    string `json:"threatId"`
		ThreatName                  string `json:"threatName"`
		UpdatedAt                   string `json:"updatedAt"`
	} `json:"threatInfo"`
	// ⭐ ContainerInfo - ข้อมูล Container (Docker/K8s)
	ContainerInfo struct {
		ID     string   `json:"id"`
		Image  string   `json:"image"`
		Labels []string `json:"labels"`
		Name   string   `json:"name"`
	} `json:"containerInfo"`
	// ⭐ EcsInfo - ข้อมูล AWS ECS/Fargate
	EcsInfo struct {
		ClusterArn           string `json:"clusterArn"`
		ClusterName          string `json:"clusterName"`
		ContainerInstanceArn string `json:"containerInstanceArn"`
		LaunchType           string `json:"launchType"`
		ServiceName          string `json:"serviceName"`
		TaskArn              string `json:"taskArn"`
		TaskDefinition       string `json:"taskDefinition"`
	} `json:"ecsInfo"`
	// ⭐ KubernetesInfo - ข้อมูล Kubernetes
	KubernetesInfo struct {
		Cluster          string   `json:"cluster"`
		ControllerKind   string   `json:"controllerKind"`
		ControllerLabels []string `json:"controllerLabels"`
		ControllerName   string   `json:"controllerName"`
		Namespace        string   `json:"namespace"`
		NamespaceLabels  []string `json:"namespaceLabels"`
		Node             string   `json:"node"`
		NodeLabels       []string `json:"nodeLabels"`
		Pod              string   `json:"pod"`
		PodLabels        []string `json:"podLabels"`
	} `json:"kubernetesInfo"`
	// ⭐ MitigationStatus - รายละเอียด Mitigation Actions
	MitigationStatus []struct {
		Action              string `json:"action"`
		ActionsCounters     any    `json:"actionsCounters"`
		AgentSupportsReport bool   `json:"agentSupportsReport"`
		GroupNotFound       bool   `json:"groupNotFound"`
		InheritedFrom       string `json:"inheritedFrom"`
		LastUpdate          string `json:"lastUpdate"`
		LatestReport        any    `json:"latestReport"`
		MitigationEndedAt   string `json:"mitigationEndedAt"`
		MitigationStartedAt string `json:"mitigationStartedAt"`
		ReportID            string `json:"reportId"`
		Status              string `json:"status"`
	} `json:"mitigationStatus"`
	// ⭐ WhiteningOptions - ตัวเลือกการ Whitelist
	WhiteningOptions []string `json:"whiteningOptions"`
}

// S1Threat simplified for transform
type S1Threat struct {
	ID                   string
	AgentID              string
	AgentComputerName    string
	AgentOsName          string
	AgentOsType          string
	AgentOsRevision      string // ⭐ เพิ่ม
	AgentIP              string
	AgentVersion         string // ⭐ เพิ่ม
	AgentDomain          string // ⭐ เพิ่ม
	ExternalIP           string // ⭐ เพิ่ม
	AccountID            string // S1 Account ID
	AccountName          string // S1 Account Name
	SiteID               string // S1 Site ID
	SiteName             string
	GroupID              string // S1 Group ID
	GroupName            string
	Classification       string
	ClassificationSource string // ⭐ เพิ่ม (Static, Engine, Cloud)
	ConfidenceLevel      string
	ThreatName           string
	FilePath             string
	FileHash             string // SHA256
	SHA1                 string // ⭐ เพิ่ม
	MD5                  string // ⭐ เพิ่ม
	MitigationStatus     string
	AnalystVerdict       string
	MitreTactic          string
	MitreTechnique       string
	CreatedAt            string
	Username             string
	InitiatedBy          string
	Storyline            string // ⭐ เพิ่ม
	CommandArguments     string // ⭐ เพิ่ม
	DetectionEngines     string // ⭐ เพิ่ม
	OriginatorProcess    string // ⭐ เพิ่ม
}

// S1Activity โครงสร้าง Activity จาก S1 API (FULL structure)
type S1Activity struct {
	ID                   string         `json:"id"`
	ActivityType         int            `json:"activityType"`
	ActivityUuid         string         `json:"activityUuid"` // ⭐ เพิ่ม
	AccountID            string         `json:"accountId"`
	AccountName          string         `json:"accountName"`
	AgentID              string         `json:"agentId"`
	AgentUpdatedVersion  string         `json:"agentUpdatedVersion"` // ⭐ เพิ่ม
	Comments             string         `json:"comments"`            // ⭐ เพิ่ม
	CreatedAt            string         `json:"createdAt"`
	Description          string         `json:"description"` // ⭐ เพิ่ม
	GroupID              string         `json:"groupId"`     // ⭐ เพิ่ม
	GroupName            string         `json:"groupName"`
	Hash                 string         `json:"hash"`     // ⭐ เพิ่ม
	OsFamily             string         `json:"osFamily"` // ⭐ เพิ่ม
	PrimaryDescription   string         `json:"primaryDescription"`
	SecondaryDescription string         `json:"secondaryDescription"`
	SiteID               string         `json:"siteId"` // ⭐ เพิ่ม
	SiteName             string         `json:"siteName"`
	ThreatID             string         `json:"threatId"`  // ⭐ เพิ่ม
	UpdatedAt            string         `json:"updatedAt"` // ⭐ เพิ่ม
	UserID               string         `json:"userId"`
	Data                 map[string]any `json:"data"`
}

// ⭐ S1AlertResponse โครงสร้าง Alert จาก Cloud Detection API (full structure)
type S1AlertResponse struct {
	AgentDetectionInfo struct {
		AccountID   string `json:"accountId"`
		MachineType string `json:"machineType"`
		Name        string `json:"name"`
		OsFamily    string `json:"osFamily"`
		OsName      string `json:"osName"`
		OsRevision  string `json:"osRevision"`
		SiteID      string `json:"siteId"`
		UUID        string `json:"uuid"`
		Version     string `json:"version"`
	} `json:"agentDetectionInfo"`
	AgentRealtimeInfo struct {
		ID               string `json:"id"`
		Infected         bool   `json:"infected"`
		IsActive         bool   `json:"isActive"`
		IsDecommissioned bool   `json:"isDecommissioned"`
		MachineType      string `json:"machineType"`
		Name             string `json:"name"`
		OS               string `json:"os"`
		UUID             string `json:"uuid"`
	} `json:"agentRealtimeInfo"`
	AlertInfo struct {
		AlertID           string `json:"alertId"`
		AnalystVerdict    string `json:"analystVerdict"`
		CreatedAt         string `json:"createdAt"`
		DnsRequest        string `json:"dnsRequest"`
		DnsResponse       string `json:"dnsResponse"`
		DstIP             string `json:"dstIp"`
		DstPort           string `json:"dstPort"`
		DvEventID         string `json:"dvEventId"`
		EventType         string `json:"eventType"`
		HitType           string `json:"hitType"`
		IncidentStatus    string `json:"incidentStatus"`
		IndicatorCategory string `json:"indicatorCategory"`
		IndicatorDesc     string `json:"indicatorDescription"`
		IndicatorName     string `json:"indicatorName"`
		IsEdr             bool   `json:"isEdr"`
		ModulePath        string `json:"modulePath"`
		ModuleSha1        string `json:"moduleSha1"`
		NetEventDirection string `json:"netEventDirection"`
		RegistryKeyPath   string `json:"registryKeyPath"`
		RegistryPath      string `json:"registryPath"`
		RegistryValue     string `json:"registryValue"`
		ReportedAt        string `json:"reportedAt"`
		Source            string `json:"source"`
		SrcIP             string `json:"srcIp"`
		SrcMachineIP      string `json:"srcMachineIp"`
		SrcPort           string `json:"srcPort"`
		UpdatedAt         string `json:"updatedAt"`
	} `json:"alertInfo"`
	RuleInfo struct {
		Description   string `json:"description"`
		ID            string `json:"id"`
		Name          string `json:"name"`
		QueryLang     string `json:"queryLang"`
		QueryType     string `json:"queryType"`
		S1QL          string `json:"s1ql"`
		ScopeLevel    string `json:"scopeLevel"`
		Severity      string `json:"severity"`
		TreatAsThreat string `json:"treatAsThreat"`
	} `json:"ruleInfo"`
	SourceProcessInfo struct {
		CommandLine        string `json:"commandline"`
		EffectiveUser      string `json:"effectiveUser"`
		FileHashMD5        string `json:"fileHashMd5"`
		FileHashSHA1       string `json:"fileHashSha1"`
		FileHashSHA256     string `json:"fileHashSha256"`
		FilePath           string `json:"filePath"`
		FileSignerIdentity string `json:"fileSignerIdentity"`
		IntegrityLevel     string `json:"integrityLevel"`
		Name               string `json:"name"`
		PID                string `json:"pid"`
		PidStartTime       string `json:"pidStarttime"`
		Storyline          string `json:"storyline"`
		Subsystem          string `json:"subsystem"`
		UniqueID           string `json:"uniqueId"`
		User               string `json:"user"`
	} `json:"sourceProcessInfo"`
	SourceParentProcessInfo struct {
		CommandLine        string `json:"commandline"`
		FileHashMD5        string `json:"fileHashMd5"`
		FileHashSHA1       string `json:"fileHashSha1"`
		FileHashSHA256     string `json:"fileHashSha256"`
		FilePath           string `json:"filePath"`
		FileSignerIdentity string `json:"fileSignerIdentity"`
		IntegrityLevel     string `json:"integrityLevel"`
		Name               string `json:"name"`
		PID                string `json:"pid"`
		PidStartTime       string `json:"pidStarttime"`
		Storyline          string `json:"storyline"`
		Subsystem          string `json:"subsystem"`
		UniqueID           string `json:"uniqueId"`
		User               string `json:"user"`
	} `json:"sourceParentProcessInfo"`
	TargetProcessInfo struct {
		TgtFileCreatedAt      string `json:"tgtFileCreatedAt"`
		TgtFileHashSHA1       string `json:"tgtFileHashSha1"`
		TgtFileHashSHA256     string `json:"tgtFileHashSha256"`
		TgtFileID             string `json:"tgtFileId"`
		TgtFileIsSigned       string `json:"tgtFileIsSigned"`
		TgtFileModifiedAt     string `json:"tgtFileModifiedAt"`
		TgtFileOldPath        string `json:"tgtFileOldPath"`
		TgtFilePath           string `json:"tgtFilePath"`
		TgtProcCmdLine        string `json:"tgtProcCmdLine"`
		TgtProcImagePath      string `json:"tgtProcImagePath"`
		TgtProcIntegrityLevel string `json:"tgtProcIntegrityLevel"`
		TgtProcName           string `json:"tgtProcName"`
		TgtProcPID            string `json:"tgtProcPid"`
		TgtProcSignedStatus   string `json:"tgtProcSignedStatus"`
		TgtProcStorylineID    string `json:"tgtProcStorylineId"`
		TgtProcUID            string `json:"tgtProcUid"`
		TgtProcessStartTime   string `json:"tgtProcessStartTime"`
	} `json:"targetProcessInfo"`
	ContainerInfo struct {
		ID     string `json:"id"`
		Image  string `json:"image"`
		Labels string `json:"labels"`
		Name   string `json:"name"`
	} `json:"containerInfo"`
	KubernetesInfo struct {
		Cluster          string `json:"cluster"`
		ControllerKind   string `json:"controllerKind"`
		ControllerLabels string `json:"controllerLabels"`
		ControllerName   string `json:"controllerName"`
		Namespace        string `json:"namespace"`
		NamespaceLabels  string `json:"namespaceLabels"`
		Node             string `json:"node"`
		Pod              string `json:"pod"`
		PodLabels        string `json:"podLabels"`
	} `json:"kubernetesInfo"`
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
			SetContext(ctx).
			SetHeader("Authorization", "ApiToken "+c.apiToken).
			SetQueryParams(params).
			Get(c.baseURL + "/web/api/v2.1/threats")

		if err != nil {
			// Check if error is due to context cancellation
			if ctx.Err() != nil {
				c.logger.Warn("HTTP request cancelled due to context cancellation",
					zap.String("integrationId", c.integrationID),
					zap.Int("fetchedSoFar", totalFetched),
					zap.Error(ctx.Err()))
				return totalFetched, ctx.Err()
			}
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

			// Check context before publishing (prevent publishing if cancelled during processing)
			if ctx.Err() != nil {
				c.logger.Warn("Context cancelled before publishing events, discarding page",
					zap.String("integrationId", c.integrationID),
					zap.Int("discardedEvents", len(events)),
					zap.Error(ctx.Err()))
				return totalFetched, ctx.Err()
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

// parseThreatResponse แปลง S1ThreatResponse เป็น S1Threat (ดึง fields สำคัญ)
func (c *S1Client) parseThreatResponse(r S1ThreatResponse) S1Threat {
	var tactic, technique string
	if len(r.ThreatInfo.Indicators) > 0 {
		ind := r.ThreatInfo.Indicators[0]
		if len(ind.Tactics) > 0 {
			tactic = ind.Tactics[0].Name
		}
		if len(ind.Techniques) > 0 {
			technique = ind.Techniques[0].Name
		}
	}

	// ⭐ Build detection engines string
	var engines []string
	for _, e := range r.ThreatInfo.DetectionEngines {
		engines = append(engines, e.Title)
	}
	detectionEngines := ""
	if len(engines) > 0 {
		detectionEngines = fmt.Sprintf("%v", engines)
	}

	return S1Threat{
		ID:                   r.ID,
		AgentID:              r.AgentRealtimeInfo.AgentID,
		AgentComputerName:    r.AgentRealtimeInfo.AgentComputerName,
		AgentOsName:          r.AgentRealtimeInfo.AgentOsName,
		AgentOsType:          r.AgentRealtimeInfo.AgentOsType,
		AgentOsRevision:      r.AgentDetectionInfo.AgentOsRevision, // ⭐ เพิ่ม
		AgentIP:              r.AgentDetectionInfo.AgentIpV4,
		AgentVersion:         r.AgentDetectionInfo.AgentVersion, // ⭐ เพิ่ม
		AgentDomain:          r.AgentDetectionInfo.AgentDomain,  // ⭐ เพิ่ม
		ExternalIP:           r.AgentDetectionInfo.ExternalIP,   // ⭐ เพิ่ม
		AccountID:            r.AgentDetectionInfo.AccountID,
		AccountName:          r.AgentDetectionInfo.AccountName,
		SiteID:               r.AgentDetectionInfo.SiteID,
		SiteName:             r.AgentDetectionInfo.SiteName,
		GroupID:              r.AgentDetectionInfo.GroupID,
		GroupName:            r.AgentDetectionInfo.GroupName,
		Classification:       r.ThreatInfo.Classification,
		ClassificationSource: r.ThreatInfo.ClassificationSource, // ⭐ เพิ่ม
		ConfidenceLevel:      r.ThreatInfo.ConfidenceLevel,
		ThreatName:           r.ThreatInfo.ThreatName,
		FilePath:             r.ThreatInfo.FilePath,
		FileHash:             r.ThreatInfo.Sha256,
		SHA1:                 r.ThreatInfo.Sha1, // ⭐ เพิ่ม
		MD5:                  r.ThreatInfo.Md5,  // ⭐ เพิ่ม
		MitigationStatus:     r.ThreatInfo.MitigationStatus,
		AnalystVerdict:       r.ThreatInfo.AnalystVerdict,
		MitreTactic:          tactic,
		MitreTechnique:       technique,
		CreatedAt:            r.ThreatInfo.CreatedAt,
		Username:             r.ThreatInfo.ProcessUser,
		InitiatedBy:          r.ThreatInfo.InitiatedBy,
		Storyline:            r.ThreatInfo.Storyline,                 // ⭐ เพิ่ม
		CommandArguments:     r.ThreatInfo.MaliciousProcessArguments, // ⭐ เพิ่ม
		DetectionEngines:     detectionEngines,                       // ⭐ เพิ่ม
		OriginatorProcess:    r.ThreatInfo.OriginatorProcess,         // ⭐ เพิ่ม
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

	// ⭐ สร้าง Response Actions summary
	responseActions := ""
	if t.MitigationStatus == "mitigated" {
		responseActions = "mitigated"
	}

	// ⭐ สร้าง Console Link
	consoleLink := fmt.Sprintf("%s/analyze/threats/%s/overview", c.baseURL, t.ID)

	return models.UnifiedEvent{
		ID:              t.ID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "sentinelone",
		Timestamp:       timestamp,

		Severity:        func() string {
			if t.ThreatName == "dllhostex.exe" {
				return "info"
			}
			return models.S1ThreatSeverity(t.ConfidenceLevel)
		}(),
		EventType:       "threat",
		Title:           t.ThreatName,
		Description:     fmt.Sprintf("%s - %s", t.Classification, t.MitigationStatus),

		// ⭐ Detection Details
		ThreatName:           t.ThreatName,
		Classification:       t.Classification,
		ConfidenceLevel:      t.ConfidenceLevel,
		AnalystVerdict:       t.AnalystVerdict,
		IncidentStatus:       t.MitigationStatus,
		ClassificationSource: t.ClassificationSource,
		DetectionEngines:     t.DetectionEngines,

		// MITRE ATT&CK
		MitreTactic:    t.MitreTactic,
		MitreTechnique: t.MitreTechnique,

		// ⭐ Response/Disposition
		ThreatMitigated:        t.MitigationStatus == "mitigated",
		DispositionDescription: t.MitigationStatus,
		ResponseActions:        responseActions,

		// ⭐ Console Link
		ConsoleLink: consoleLink,

		// ⭐ Storyline
		Storyline: t.Storyline,

		Host: models.HostInfo{
			Name:         t.AgentComputerName,
			IP:           t.AgentIP,
			ExternalIP:   t.ExternalIP,
			OS:           t.AgentOsName,
			OSVersion:    t.AgentOsRevision,
			AgentID:      t.AgentID,
			AgentVersion: t.AgentVersion,
			AccountID:    t.AccountID,
			AccountName:  t.AccountName,
			SiteID:       t.SiteID,
			SiteName:     t.SiteName,
			GroupID:      t.GroupID,
			GroupName:    t.GroupName,
			Domain:       t.AgentDomain,
		},
		User: models.UserInfo{
			Name: t.Username,
		},
		Process: models.ProcessInfo{
			Path:        t.FilePath,
			CommandLine: t.CommandArguments,
			SHA256:      t.FileHash,
			SHA1:        t.SHA1,
			MD5:         t.MD5,
		},
		File: models.FileInfo{
			Path:   t.FilePath,
			SHA256: t.FileHash,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"mitigationStatus":     t.MitigationStatus,
			"analystVerdict":       t.AnalystVerdict,
			"initiatedBy":          t.InitiatedBy,
			"storyline":            t.Storyline,
			"classificationSource": t.ClassificationSource,
			"detectionEngines":     t.DetectionEngines,
			"originatorProcess":    t.OriginatorProcess,
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

		resp, err := req.SetContext(ctx).Get(c.baseURL + "/web/api/v2.1/activities")

		if err != nil {
			// Check if error is due to context cancellation
			if ctx.Err() != nil {
				c.logger.Warn("HTTP request cancelled due to context cancellation",
					zap.String("integrationId", c.integrationID),
					zap.Int("fetchedSoFar", totalFetched),
					zap.Error(ctx.Err()))
				return totalFetched, ctx.Err()
			}
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

			// Check context before publishing (prevent publishing if cancelled during processing)
			if ctx.Err() != nil {
				c.logger.Warn("Context cancelled before publishing events, discarding page",
					zap.String("integrationId", c.integrationID),
					zap.Int("discardedEvents", len(events)),
					zap.Error(ctx.Err()))
				return totalFetched, ctx.Err()
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

	// ดึง computerName จาก data (ถ้ามี)
	computerName := ""
	if data := a.Data; data != nil {
		if cn, ok := data["computerName"].(string); ok {
			computerName = cn
		}
	}

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
			Name:        computerName,
			AccountID:   a.AccountID,
			AccountName: a.AccountName,
			SiteID:      a.SiteID,
			SiteName:    a.SiteName,
			GroupID:     a.GroupID,
			GroupName:   a.GroupName,
		},
		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"activityType": fmt.Sprintf("%d", a.ActivityType),
			"activityUuid": a.ActivityUuid,
			"accountName":  a.AccountName,
			"threatId":     a.ThreatID,
			"hash":         a.Hash,
		},
	}
}

// ⭐ FetchAlerts ดึง Cloud Detection Alerts จาก S1 API แบบ Streaming
func (c *S1Client) FetchAlerts(ctx context.Context, startTime, endTime time.Time, onPageEvents OnPageEvents, onChunkComplete OnChunkComplete) (int, error) {
	c.logger.Info("Fetching S1 cloud detection alerts with cursor pagination (streaming)",
		zap.String("tenantId", c.tenantID),
		zap.String("from", startTime.Format(time.RFC3339)),
		zap.String("to", endTime.Format(time.RFC3339)))

	totalFetched := 0
	limit := 1000
	pageDelay := 50 * time.Millisecond

	cursor := ""
	page := 1

	for {
		// Check context ก่อนทำ request
		select {
		case <-ctx.Done():
			c.logger.Warn("Context cancelled, stopping alerts fetch",
				zap.String("integrationId", c.integrationID),
				zap.Int("fetchedSoFar", totalFetched),
				zap.Error(ctx.Err()))
			return totalFetched, ctx.Err()
		default:
		}

		// สร้าง request params
		params := map[string]string{
			"limit":          fmt.Sprintf("%d", limit),
			"sortBy":         "alertInfo.createdAt",
			"sortOrder":      "desc",
			"createdAt__gte": startTime.Format("2006-01-02T15:04:05.000Z"),
			"createdAt__lte": endTime.Format("2006-01-02T15:04:05.000Z"),
		}
		if cursor != "" {
			params["cursor"] = cursor
		}

		c.logger.Debug("Fetching alerts page",
			zap.Int("page", page),
			zap.Bool("hasCursor", cursor != ""))

		resp, err := c.client.R().
			SetContext(ctx).
			SetHeader("Authorization", "ApiToken "+c.apiToken).
			SetQueryParams(params).
			Get(c.baseURL + "/web/api/v2.1/cloud-detection/alerts")

		if err != nil {
			// Check if error is due to context cancellation
			if ctx.Err() != nil {
				c.logger.Warn("HTTP request cancelled due to context cancellation",
					zap.String("integrationId", c.integrationID),
					zap.Int("fetchedSoFar", totalFetched),
					zap.Error(ctx.Err()))
				return totalFetched, ctx.Err()
			}
			return totalFetched, fmt.Errorf("failed to fetch alerts: %w", err)
		}

		if resp.StatusCode() != 200 {
			return totalFetched, fmt.Errorf("S1 API error: status %d, body: %s", resp.StatusCode(), resp.String())
		}

		var result struct {
			Data       []S1AlertResponse `json:"data"`
			Pagination struct {
				NextCursor string `json:"nextCursor"`
				TotalItems int    `json:"totalItems"`
			} `json:"pagination"`
		}

		if err := json.Unmarshal(resp.Body(), &result); err != nil {
			return totalFetched, fmt.Errorf("failed to parse alerts: %w", err)
		}

		// แปลง response เป็น UnifiedEvent และส่งไป Vector ทันที
		if len(result.Data) > 0 {
			events := make([]models.UnifiedEvent, 0, len(result.Data))
			for _, a := range result.Data {
				event := c.transformAlert(a)
				events = append(events, event)
			}

			// Check context before publishing (prevent publishing if cancelled during processing)
			if ctx.Err() != nil {
				c.logger.Warn("Context cancelled before publishing events, discarding page",
					zap.String("integrationId", c.integrationID),
					zap.Int("discardedEvents", len(events)),
					zap.Error(ctx.Err()))
				return totalFetched, ctx.Err()
			}

			// ส่ง events ไป Vector ทันที (Streaming)
			if onPageEvents != nil {
				if err := onPageEvents(events); err != nil {
					c.logger.Error("Failed to publish alert events", zap.Error(err))
				}
			}

			totalFetched += len(events)
		}

		c.logger.Info("Fetched alerts page",
			zap.Int("page", page),
			zap.Int("pageCount", len(result.Data)),
			zap.Int("totalFetched", totalFetched))

		// แสดง totalItems เฉพาะ page แรก
		if page == 1 && result.Pagination.TotalItems > 0 {
			c.logger.Info("S1 API reports total alerts", zap.Int("totalItems", result.Pagination.TotalItems))
		}

		// ตรวจสอบว่ามีหน้าถัดไปหรือไม่
		if result.Pagination.NextCursor == "" || len(result.Data) == 0 {
			c.logger.Info("Alerts pagination complete")
			break
		}

		cursor = result.Pagination.NextCursor
		page++

		// delay เพื่อไม่ hit rate limit
		time.Sleep(pageDelay)
	}

	c.logger.Info("Fetched S1 alerts total", zap.Int("count", totalFetched))

	if onChunkComplete != nil {
		onChunkComplete(endTime)
	}

	return totalFetched, nil
}

// ⭐ transformAlert แปลง S1AlertResponse เป็น UnifiedEvent (เก็บ full structure)
func (c *S1Client) transformAlert(a S1AlertResponse) models.UnifiedEvent {
	timestamp, _ := time.Parse(time.RFC3339, a.AlertInfo.CreatedAt)

	// เก็บ raw data ครบทั้งหมด
	raw, _ := json.Marshal(a)
	var rawMap map[string]any
	json.Unmarshal(raw, &rawMap)
	rawMap["url_hash"] = c.GetURLHash()

	// แปลง severity
	severity := s1AlertSeverity(a.RuleInfo.Severity)

	// ⭐ สร้าง Console Link
	consoleLink := fmt.Sprintf("%s/alerts/details/%s", c.baseURL, a.AlertInfo.AlertID)

	return models.UnifiedEvent{
		ID:              a.AlertInfo.AlertID,
		TenantID:        c.tenantID,
		IntegrationID:   c.integrationID,
		IntegrationName: c.integrationName,
		Source:          "sentinelone",
		Timestamp:       timestamp,
		Severity:        severity,
		EventType:       "alert",
		Title:           a.RuleInfo.Name,
		Description:     fmt.Sprintf("[%s] %s - %s", a.AlertInfo.Source, a.AlertInfo.EventType, a.RuleInfo.S1QL),

		// ⭐ Detection Details
		RuleName:         a.RuleInfo.Name,
		AnalystVerdict:   a.AlertInfo.AnalystVerdict,
		IncidentStatus:   a.AlertInfo.IncidentStatus,
		DetectionEngines: a.AlertInfo.Source,

		// ⭐ Console Link
		ConsoleLink: consoleLink,
		Storyline:   a.SourceProcessInfo.Storyline,

		Host: models.HostInfo{
			Name:         a.AgentDetectionInfo.Name,
			IP:           a.AlertInfo.SrcIP,
			OS:           a.AgentDetectionInfo.OsName,
			OSVersion:    a.AgentDetectionInfo.OsRevision,
			Platform:     a.AgentDetectionInfo.OsFamily,
			AgentID:      a.AgentRealtimeInfo.ID,
			AgentVersion: a.AgentDetectionInfo.Version,
			AccountID:    a.AgentDetectionInfo.AccountID,
			SiteID:       a.AgentDetectionInfo.SiteID,
		},
		User: models.UserInfo{
			Name: a.SourceProcessInfo.User,
		},
		Process: models.ProcessInfo{
			Name:        a.SourceProcessInfo.Name,
			Path:        a.SourceProcessInfo.FilePath,
			CommandLine: a.SourceProcessInfo.CommandLine,
			SHA256:      a.SourceProcessInfo.FileHashSHA256,
			SHA1:        a.SourceProcessInfo.FileHashSHA1,
			MD5:         a.SourceProcessInfo.FileHashMD5,
		},
		File: models.FileInfo{
			Path:   a.TargetProcessInfo.TgtFilePath,
			SHA256: a.TargetProcessInfo.TgtFileHashSHA256,
		},
		Network: models.NetworkInfo{
			SrcIP: a.AlertInfo.SrcIP,
			DstIP: a.AlertInfo.DstIP,
		},

		// ⭐ Parent Process
		ParentProcess: models.ParentProcessInfo{
			Name:        a.SourceParentProcessInfo.Name,
			Path:        a.SourceParentProcessInfo.FilePath,
			CommandLine: a.SourceParentProcessInfo.CommandLine,
			SHA256:      a.SourceParentProcessInfo.FileHashSHA256,
			MD5:         a.SourceParentProcessInfo.FileHashMD5,
			UserName:    a.SourceParentProcessInfo.User,
		},

		Raw:         rawMap,
		CollectedAt: time.Now().UTC(),
		Metadata: map[string]string{
			"alertSource":    a.AlertInfo.Source,
			"eventType":      a.AlertInfo.EventType,
			"hitType":        a.AlertInfo.HitType,
			"incidentStatus": a.AlertInfo.IncidentStatus,
			"analystVerdict": a.AlertInfo.AnalystVerdict,
			"ruleId":         a.RuleInfo.ID,
			"ruleSeverity":   a.RuleInfo.Severity,
			"storyline":      a.SourceProcessInfo.Storyline,
		},
	}
}

// s1AlertSeverity แปลง S1 rule severity เป็น unified severity
func s1AlertSeverity(severity string) string {
	switch severity {
	case "Critical":
		return "critical"
	case "High":
		return "high"
	case "Medium":
		return "medium"
	case "Low":
		return "low"
	default:
		return "info"
	}
}
