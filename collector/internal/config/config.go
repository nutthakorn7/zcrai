package config

import (
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/joho/godotenv"
	"go.uber.org/zap"
)

// Integration จาก Elysia backend
type Integration struct {
	ID             string `json:"id"`
	TenantID       string `json:"tenantId"`
	Name           string `json:"name"`     // ชื่อ Integration สำหรับแสดงผล
	Type           string `json:"type"`     // sentinelone, crowdstrike, ai
	Provider       string `json:"provider"` // s1, crowdstrike, openai, claude
	Config         string `json:"config"`   // JSON string (decrypted)
	Status         string `json:"status"`
	LastSyncAt     string `json:"lastSyncAt"`
	LastSyncStatus string `json:"lastSyncStatus"` // pending, success, error
}

// S1Config โครงสร้าง config ของ SentinelOne
type S1Config struct {
	BaseURL       string           `json:"baseUrl"`
	APIToken      string           `json:"apiToken"`
	FetchSettings *S1FetchSettings `json:"fetchSettings,omitempty"`
}

// S1FetchSettings ตั้งค่าการดึงข้อมูล SentinelOne
type S1FetchSettings struct {
	Threats    *FetchSettingItem `json:"threats,omitempty"`
	Activities *FetchSettingItem `json:"activities,omitempty"`
	Alerts     *FetchSettingItem `json:"alerts,omitempty"`
}

// CrowdStrikeConfig โครงสร้าง config ของ CrowdStrike
type CrowdStrikeConfig struct {
	BaseURL       string           `json:"baseUrl"`
	ClientID      string           `json:"clientId"`
	ClientSecret  string           `json:"clientSecret"`
	FetchSettings *CSFetchSettings `json:"fetchSettings,omitempty"`
}

// CSFetchSettings ตั้งค่าการดึงข้อมูล CrowdStrike
type CSFetchSettings struct {
	Alerts     *FetchSettingItem `json:"alerts,omitempty"`
	Detections *FetchSettingItem `json:"detections,omitempty"`
	Incidents  *FetchSettingItem `json:"incidents,omitempty"`
}

// FetchSettingItem ตั้งค่าแต่ละประเภทข้อมูล
type FetchSettingItem struct {
	Enabled bool `json:"enabled"`
	Days    int  `json:"days"`
}

// Config หลักของ Collector
type Config struct {
	ElysiaURL       string        // URL ของ Elysia backend
	VectorURL       string        // URL ของ Vector pipeline
	PollInterval    time.Duration // Interval สำหรับ scheduled polling
	LookbackDays    int           // ดึงข้อมูลย้อนหลังกี่วัน
	CollectorAPIKey string        // API Key สำหรับ authenticate กับ Elysia
	Logger          *zap.Logger

	// ClickHouse Config (for migrations)
	ClickHouseHost     string
	ClickHousePort     string
	ClickHouseUser     string
	ClickHousePassword string
	ClickHouseDB       string
}

var AppConfig *Config

// Load โหลด config จาก env
func Load() (*Config, error) {
	_ = godotenv.Load()

	logger, _ := zap.NewProduction()
	if os.Getenv("ENV") == "development" {
		logger, _ = zap.NewDevelopment()
	}

	pollInterval, _ := time.ParseDuration(os.Getenv("POLL_INTERVAL"))
	if pollInterval == 0 {
		pollInterval = 5 * time.Minute // Default 5 นาที
	}

	lookbackDays := 7 // Default 7 วัน
	if os.Getenv("LOOKBACK_DAYS") != "" {
		fmt.Sscanf(os.Getenv("LOOKBACK_DAYS"), "%d", &lookbackDays)
	}

	AppConfig = &Config{
		ElysiaURL:       getEnv("ELYSIA_URL", "http://localhost:8000"),
		VectorURL:       getEnv("VECTOR_URL", "http://localhost:8686"),
		PollInterval:    pollInterval,
		LookbackDays:    lookbackDays,
		CollectorAPIKey: getEnv("COLLECTOR_API_KEY", "dev_collector_key_change_in_production"),
		Logger:          logger,

		ClickHouseHost:     getEnv("CLICKHOUSE_HOST", "localhost"),
		ClickHousePort:     getEnv("CLICKHOUSE_PORT", "9000"),
		ClickHouseUser:     getEnv("CLICKHOUSE_USER", "default"),
		ClickHousePassword: getEnv("CLICKHOUSE_PASSWORD", "clickhouse"),
		ClickHouseDB:       getEnv("CLICKHOUSE_DB", "zcrai"),
	}

	return AppConfig, nil
}

// FetchIntegrations ดึง integrations จาก Elysia backend
func (c *Config) FetchIntegrations(integrationType string) ([]Integration, error) {
	client := resty.New()

	resp, err := client.R().
		SetHeader("X-Collector-Key", c.CollectorAPIKey).
		SetQueryParam("type", integrationType).
		Get(c.ElysiaURL + "/integrations/collector")

	if err != nil {
		return nil, fmt.Errorf("failed to fetch integrations: %w", err)
	}

	if resp.StatusCode() != 200 {
		return nil, fmt.Errorf("failed to fetch integrations: status %d", resp.StatusCode())
	}

	var result struct {
		Integrations []Integration `json:"integrations"`
	}
	if err := json.Unmarshal(resp.Body(), &result); err != nil {
		return nil, fmt.Errorf("failed to parse integrations: %w", err)
	}

	return result.Integrations, nil
}

// ParseS1Config แปลง config string เป็น S1Config
func ParseS1Config(configStr string) (*S1Config, error) {
	var cfg S1Config
	if err := json.Unmarshal([]byte(configStr), &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// ParseCrowdStrikeConfig แปลง config string เป็น CrowdStrikeConfig
func ParseCrowdStrikeConfig(configStr string) (*CrowdStrikeConfig, error) {
	var cfg CrowdStrikeConfig
	if err := json.Unmarshal([]byte(configStr), &cfg); err != nil {
		return nil, err
	}
	return &cfg, nil
}

// UpdateSyncStatus อัพเดท sync status ไปยัง Elysia backend
func (c *Config) UpdateSyncStatus(tenantID, provider, status string, syncError string) error {
	client := resty.New()

	body := map[string]string{
		"tenantId": tenantID,
		"provider": provider,
		"status":   status,
	}
	if syncError != "" {
		body["error"] = syncError
	}

	resp, err := client.R().
		SetHeader("X-Collector-Key", c.CollectorAPIKey).
		SetHeader("Content-Type", "application/json").
		SetBody(body).
		Post(c.ElysiaURL + "/integrations/collector/sync-status")

	if err != nil {
		return fmt.Errorf("failed to update sync status: %w", err)
	}

	if resp.StatusCode() != 200 {
		return fmt.Errorf("failed to update sync status: status %d", resp.StatusCode())
	}

	return nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}
