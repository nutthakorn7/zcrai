package publisher

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/zrd4y/zcrAI/collector/internal/clickhouse"
	"github.com/zrd4y/zcrAI/collector/pkg/models"
	"go.uber.org/zap"
)

// Publisher sends events to ClickHouse (with Vector fallback)
type Publisher struct {
	vectorURL string
	client    *resty.Client
	chClient  *clickhouse.Client
	logger    *zap.Logger
	useCH     bool // Use ClickHouse directly instead of Vector
}

// NewPublisher creates a new Publisher with optional ClickHouse client
func NewPublisher(vectorURL string, chClient *clickhouse.Client, logger *zap.Logger) *Publisher {
	client := resty.New().
		SetTimeout(30 * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(2 * time.Second)

	// Use ClickHouse directly if client is provided
	useCH := chClient != nil

	return &Publisher{
		vectorURL: vectorURL,
		client:    client,
		chClient:  chClient,
		logger:    logger,
		useCH:     useCH,
	}
}

// Publish sends events to ClickHouse directly or Vector
func (p *Publisher) Publish(events []models.UnifiedEvent) error {
	if len(events) == 0 {
		return nil
	}

	// Use ClickHouse directly if available
	if p.useCH && p.chClient != nil {
		return p.publishToCH(events)
	}

	// Fallback to Vector
	return p.publishToVector(events)
}

// publishToCH writes events directly to ClickHouse
func (p *Publisher) publishToCH(events []models.UnifiedEvent) error {
	p.logger.Info("Publishing events directly to ClickHouse", zap.Int("count", len(events)))

	// Convert UnifiedEvent to map for ClickHouse insert
	chEvents := make([]map[string]interface{}, len(events))
	for i, event := range events {
		rawJSON, _ := json.Marshal(event.Raw)
		chEvents[i] = map[string]interface{}{
			"id":              event.ID,
			"tenant_id":       event.TenantID,
			"timestamp":       event.Timestamp,
			"severity":        event.Severity,
			"source":          event.Source,
			"event_type":      event.EventType,
			"host_name":       event.Host.Name,
			"user_name":       event.User.Name,
			"mitre_tactic":    event.MitreTactic,
			"mitre_technique": event.MitreTechnique,
			"raw_data":        string(rawJSON),
		}
	}

	if err := p.chClient.InsertEvents(chEvents); err != nil {
		return fmt.Errorf("failed to insert to ClickHouse: %w", err)
	}

	p.logger.Info("Published events to ClickHouse successfully", zap.Int("count", len(events)))
	return nil
}

// publishToVector sends events to Vector pipeline (NDJSON)
func (p *Publisher) publishToVector(events []models.UnifiedEvent) error {
	p.logger.Info("Publishing events to Vector", zap.Int("count", len(events)))

	var ndjson []byte
	for _, event := range events {
		line, err := json.Marshal(event)
		if err != nil {
			p.logger.Warn("Failed to marshal event", zap.String("id", event.ID), zap.Error(err))
			continue
		}
		ndjson = append(ndjson, line...)
		ndjson = append(ndjson, '\n')
	}

	resp, err := p.client.R().
		SetHeader("Content-Type", "application/x-ndjson").
		SetBody(ndjson).
		Post(p.vectorURL + "/events")

	if err != nil {
		return fmt.Errorf("failed to publish to Vector: %w", err)
	}

	if resp.StatusCode() >= 400 {
		return fmt.Errorf("Vector returned error: status %d, body: %s", resp.StatusCode(), resp.String())
	}

	p.logger.Info("Published events to Vector successfully", zap.Int("count", len(events)))
	return nil
}

// PublishBatch sends events in batches
func (p *Publisher) PublishBatch(events []models.UnifiedEvent, batchSize int) error {
	if batchSize <= 0 {
		batchSize = 500
	}

	for i := 0; i < len(events); i += batchSize {
		end := i + batchSize
		if end > len(events) {
			end = len(events)
		}

		batch := events[i:end]
		if err := p.Publish(batch); err != nil {
			return fmt.Errorf("failed to publish batch %d-%d: %w", i, end, err)
		}
	}

	return nil
}

