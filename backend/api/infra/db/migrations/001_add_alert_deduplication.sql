-- Migration: Add Alert Deduplication Fields
-- Date: 2025-12-14
-- Description: Adds fingerprinting and deduplication tracking to alerts table

-- Add case_id column if missing
ALTER TABLE alerts 
  ADD COLUMN IF NOT EXISTS case_id UUID REFERENCES cases(id);

-- Add new columns
ALTER TABLE alerts 
  ADD COLUMN IF NOT EXISTS fingerprint VARCHAR(64),
  ADD COLUMN IF NOT EXISTS duplicate_count INTEGER DEFAULT 1 NOT NULL,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMP DEFAULT NOW() NOT NULL,
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Backfill fingerprints for existing alerts
-- Use MD5 for backward compatibility (SHA256 would be better but MD5 is available in all Postgres versions)
UPDATE alerts 
SET 
  fingerprint = MD5(CONCAT(source, '|', severity, '|', title)),
  first_seen_at = COALESCE(created_at, NOW()),
  last_seen_at = COALESCE(updated_at, NOW())
WHERE fingerprint IS NULL;

-- Make fingerprint non-null after backfill
ALTER TABLE alerts 
  ALTER COLUMN fingerprint SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS alerts_fingerprint_idx ON alerts(fingerprint);
CREATE INDEX IF NOT EXISTS alerts_last_seen_idx ON alerts(last_seen_at);

-- Optional: Remove old fields if they exist (breaking change!)
-- ALTER TABLE alerts DROP COLUMN IF EXISTS reviewed_by;
-- ALTER TABLE alerts DROP COLUMN IF EXISTS reviewed_at;
-- ALTER TABLE alerts DROP COLUMN IF EXISTS dismiss_reason;
-- ALTER TABLE alerts DROP COLUMN IF EXISTS promoted_case_id;
-- ALTER TABLE alerts DROP COLUMN IF EXISTS correlation_id;
