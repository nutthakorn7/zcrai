-- Migration: Add Notification Channels for Slack/Teams
-- Date: 2025-12-14
-- Description: Adds notification_channels table for external webhook integrations

-- Create notification_channels table
CREATE TABLE IF NOT EXISTS notification_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('slack', 'teams', 'webhook')),
  webhook_url TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true NOT NULL,
  min_severity TEXT CHECK (min_severity IN ('info', 'low', 'medium', 'high', 'critical')),
  event_types JSONB,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS notification_channels_tenant_idx ON notification_channels(tenant_id);
CREATE INDEX IF NOT EXISTS notification_channels_enabled_idx ON notification_channels(enabled);

-- Add comment
COMMENT ON TABLE notification_channels IS 'External notification channels (Slack, Teams, custom webhooks) for real-time alerts';
