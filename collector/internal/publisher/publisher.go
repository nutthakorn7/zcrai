package publisher

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/zrd4y/zcrAI/collector/pkg/models"
	"go.uber.org/zap"
)

// Publisher ส่ง events ไปยัง Vector pipeline
type Publisher struct {
	vectorURL string
	client    *resty.Client
	logger    *zap.Logger
}

// NewPublisher สร้าง Publisher ใหม่
func NewPublisher(vectorURL string, logger *zap.Logger) *Publisher {
	client := resty.New().
		SetTimeout(30 * time.Second).
		SetRetryCount(3).
		SetRetryWaitTime(2 * time.Second)

	return &Publisher{
		vectorURL: vectorURL,
		client:    client,
		logger:    logger,
	}
}

// Publish ส่ง events ไปยัง Vector (batch)
func (p *Publisher) Publish(events []models.UnifiedEvent) error {
	if len(events) == 0 {
		return nil
	}

	p.logger.Info("Publishing events to Vector", zap.Int("count", len(events)))

	// Vector รับ NDJSON (newline-delimited JSON)
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

// PublishBatch ส่ง events แบบ batch (แบ่งเป็นชุดย่อย)
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
