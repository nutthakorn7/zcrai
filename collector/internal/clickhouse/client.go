package clickhouse

import (
	"database/sql"
	"fmt"
	"time"

	_ "github.com/ClickHouse/clickhouse-go/v2"
	"go.uber.org/zap"
)

// Client สำหรับ query ข้อมูลจาก ClickHouse
type Client struct {
	db     *sql.DB
	logger *zap.Logger
}

// Config สำหรับ ClickHouse connection
type Config struct {
	Host     string
	Port     string
	Database string
	Username string
	Password string
}

// NewClient สร้าง ClickHouse client ใหม่
func NewClient(cfg Config, logger *zap.Logger) (*Client, error) {
	// Use Native protocol (port 9000)
	dsn := fmt.Sprintf("clickhouse://%s:%s@%s:%s/%s?debug=false",
		cfg.Username, cfg.Password, cfg.Host, cfg.Port, cfg.Database)

	db, err := sql.Open("clickhouse", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open clickhouse connection: %w", err)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping clickhouse: %w", err)
	}

	logger.Info("Connected to ClickHouse")

	return &Client{
		db:     db,
		logger: logger,
	}, nil
}

// Close ปิด connection
func (c *Client) Close() error {
	return c.db.Close()
}

// GetLatestTimestamp ดึง timestamp ล่าสุดของ events ตาม tenant_id และ source
// ใช้สำหรับเช็คว่า tenant นี้มี data อยู่แล้วหรือไม่ (เพื่อทำ incremental sync)
func (c *Client) GetLatestTimestamp(tenantID, source string) (time.Time, error) {
	query := `
		SELECT max(timestamp) 
		FROM security_events 
		WHERE tenant_id = ? AND source = ?
	`

	var maxTime time.Time
	err := c.db.QueryRow(query, tenantID, source).Scan(&maxTime)
	if err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, nil // ไม่มีข้อมูล
		}
		return time.Time{}, fmt.Errorf("failed to query latest timestamp: %w", err)
	}

	// ClickHouse returns zero time if no data
	if maxTime.IsZero() || maxTime.Year() == 1970 {
		return time.Time{}, nil
	}

	c.logger.Debug("Found latest timestamp",
		zap.String("tenantId", tenantID),
		zap.String("source", source),
		zap.Time("timestamp", maxTime))

	return maxTime, nil
}

// HasExistingData เช็คว่า tenant นี้มี data ของ source นี้อยู่แล้วหรือไม่
func (c *Client) HasExistingData(tenantID, source string) (bool, error) {
	query := `
		SELECT count() 
		FROM security_events 
		WHERE tenant_id = ? AND source = ?
		LIMIT 1
	`

	var count uint64
	err := c.db.QueryRow(query, tenantID, source).Scan(&count)
	if err != nil {
		return false, fmt.Errorf("failed to check existing data: %w", err)
	}

	return count > 0, nil
}

// GetDataStats ดึง stats ของ data ตาม tenant_id และ source
func (c *Client) GetDataStats(tenantID, source string) (Stats, error) {
	query := `
		SELECT 
			count() as total_events,
			min(timestamp) as oldest_event,
			max(timestamp) as newest_event
		FROM security_events 
		WHERE tenant_id = ? AND source = ?
	`

	var stats Stats
	err := c.db.QueryRow(query, tenantID, source).Scan(
		&stats.TotalEvents,
		&stats.OldestEvent,
		&stats.NewestEvent,
	)
	if err != nil {
		return Stats{}, fmt.Errorf("failed to get data stats: %w", err)
	}

	return stats, nil
}

// Stats ข้อมูลสถิติของ events
type Stats struct {
	TotalEvents uint64
	OldestEvent time.Time
	NewestEvent time.Time
}

// GetLatestTimestampByURL ดึง timestamp ล่าสุดของ events ที่มาจาก URL เฉพาะ
// ใช้สำหรับเช็คว่า URL นี้มี data ครบหรือไม่ (เพื่อตัดสินใจ Full sync vs Incremental)
// urlHash คือ hash ของ base URL (เช่น MD5 ของ "https://xxx.sentinelone.net")
func (c *Client) GetLatestTimestampByURL(tenantID, source, urlHash string) (time.Time, uint64, error) {
	// Query หา data ที่มี metadata.url_hash ตรงกับ urlHash
	// Note: เราเก็บ url_hash ใน raw field เป็น JSON
	query := `
		SELECT max(timestamp), count()
		FROM security_events 
		WHERE tenant_id = ? 
		  AND source = ?
		  AND JSONExtractString(raw, 'url_hash') = ?
	`

	var maxTime time.Time
	var count uint64
	err := c.db.QueryRow(query, tenantID, source, urlHash).Scan(&maxTime, &count)
	if err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, 0, nil
		}
		return time.Time{}, 0, fmt.Errorf("failed to query by url: %w", err)
	}

	if maxTime.IsZero() || maxTime.Year() == 1970 {
		return time.Time{}, 0, nil
	}

	c.logger.Debug("Found data for URL",
		zap.String("tenantId", tenantID),
		zap.String("source", source),
		zap.String("urlHash", urlHash),
		zap.Time("latestTimestamp", maxTime),
		zap.Uint64("count", count))

	return maxTime, count, nil
}

// CheckDataCompleteness เช็คว่า data ครบถ้วนหรือไม่ (ไม่มี gap ใหญ่)
// สำหรับตัดสินใจว่าควร Full sync หรือ Incremental
func (c *Client) CheckDataCompleteness(tenantID, source string, expectedDays int) (bool, time.Time, error) {
	stats, err := c.GetDataStats(tenantID, source)
	if err != nil {
		return false, time.Time{}, err
	}

	if stats.TotalEvents == 0 {
		return false, time.Time{}, nil // ไม่มี data เลย
	}

	// เช็คว่า data span ครอบคลุมช่วงเวลาที่คาดหวังหรือไม่
	now := time.Now().UTC()
	expectedStart := now.AddDate(0, 0, -expectedDays)

	// ถ้า oldest event อยู่หลัง expected start มากกว่า 1 วัน = ไม่ครบ
	if stats.OldestEvent.After(expectedStart.Add(24 * time.Hour)) {
		c.logger.Info("Data incomplete - missing old data",
			zap.Time("oldestEvent", stats.OldestEvent),
			zap.Time("expectedStart", expectedStart))
		return false, stats.NewestEvent, nil
	}

	// ถ้า newest event เก่ากว่า 1 ชั่วโมง = อาจมี gap
	if stats.NewestEvent.Before(now.Add(-1 * time.Hour)) {
		c.logger.Info("Data may have gap - newest event is old",
			zap.Time("newestEvent", stats.NewestEvent),
			zap.Time("now", now))
		// ยังถือว่าครบ แต่ต้อง incremental sync ต่อ
	}

	return true, stats.NewestEvent, nil
}

// OptimizeTable รัน OPTIMIZE TABLE เพื่อ dedupe ReplacingMergeTree
func (c *Client) OptimizeTable(table string) error {
	query := fmt.Sprintf("OPTIMIZE TABLE %s FINAL", table)
	_, err := c.db.Exec(query)
	if err != nil {
		c.logger.Error("Failed to optimize table", zap.String("table", table), zap.Error(err))
		return err
	}
	c.logger.Info("Optimized table", zap.String("table", table))
	return nil
}

// InsertEvents inserts events directly to ClickHouse security_events table
func (c *Client) InsertEvents(events []map[string]interface{}) error {
	if len(events) == 0 {
		return nil
	}

	tx, err := c.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	stmt, err := tx.Prepare(`
		INSERT INTO security_events (
			id, tenant_id, timestamp, severity, source, event_type,
			title, description, mitre_tactic, mitre_technique,
			host_name, host_ip, host_os, host_os_version, host_agent_id,
			host_site_name, host_group_name, user_name, user_domain, user_email,
			process_name, process_path, process_cmd, process_pid, process_ppid, process_sha256,
			file_name, file_path, file_hash, file_sha256, file_md5, file_size,
			network_src_ip, network_dst_ip, network_src_port, network_dst_port,
			network_protocol, network_direction, network_bytes_sent, network_bytes_recv,
			raw, metadata, integration_id, integration_name,
			host_account_id, host_account_name, host_site_id, host_group_id
		) VALUES (
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?, ?,
			?, ?, ?, ?
		)
	`)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, event := range events {
		_, err := stmt.Exec(
			event["id"],
			event["tenant_id"],
			event["timestamp"],
			event["severity"],
			event["source"],
			event["event_type"],
			event["title"],
			event["description"],
			event["mitre_tactic"],
			event["mitre_technique"],
			event["host_name"],
			event["host_ip"],
			event["host_os"],
			event["host_os_version"],
			event["host_agent_id"],
			event["host_site_name"],
			event["host_group_name"],
			event["user_name"],
			event["user_domain"],
			event["user_email"],
			event["process_name"],
			event["process_path"],
			event["process_cmd"],
			event["process_pid"],
			event["process_ppid"],
			event["process_sha256"],
			event["file_name"],
			event["file_path"],
			event["file_hash"],
			event["file_sha256"],
			event["file_md5"],
			event["file_size"],
			event["network_src_ip"],
			event["network_dst_ip"],
			event["network_src_port"],
			event["network_dst_port"],
			event["network_protocol"],
			event["network_direction"],
			event["network_bytes_sent"],
			event["network_bytes_recv"],
			event["raw"],
			event["metadata"],
			event["integration_id"],
			event["integration_name"],
			event["host_account_id"],
			event["host_account_name"],
			event["host_site_id"],
			event["host_group_id"],
		)
		if err != nil {
			c.logger.Warn("Failed to insert event", zap.Any("event_id", event["id"]), zap.Error(err))
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	c.logger.Info("Inserted events directly to ClickHouse", zap.Int("count", len(events)))
	return nil
}

