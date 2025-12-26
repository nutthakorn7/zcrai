-- ClickHouse Host Metrics Schema
-- Stores CPU, Memory, Disk, and Network metrics from Vector host_metrics source

CREATE TABLE IF NOT EXISTS zcrai.host_metrics
(
    -- Time
    timestamp DateTime64(3),
    
    -- Host identification
    host String,
    
    -- Metric info
    metric_name LowCardinality(String),  -- cpu_seconds_total, memory_used_bytes, etc.
    metric_value Float64,
    
    -- Labels as JSON for flexibility
    labels String DEFAULT '{}'
)
ENGINE = MergeTree()
PARTITION BY toYYYYMMDD(timestamp)
ORDER BY (host, metric_name, timestamp)
TTL toDateTime(timestamp) + INTERVAL 30 DAY
SETTINGS index_granularity = 8192;

-- Aggregated view for dashboard queries (1-minute resolution)
CREATE MATERIALIZED VIEW IF NOT EXISTS zcrai.host_metrics_1m_mv
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMMDD(minute)
ORDER BY (host, metric_name, minute)
AS
SELECT
    host,
    metric_name,
    toStartOfMinute(timestamp) AS minute,
    avgState(metric_value) AS avg_value,
    maxState(metric_value) AS max_value,
    minState(metric_value) AS min_value
FROM zcrai.host_metrics
GROUP BY host, metric_name, minute;
