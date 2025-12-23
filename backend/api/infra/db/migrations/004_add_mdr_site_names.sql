-- Add site_names column to mdr_reports table
ALTER TABLE mdr_reports ADD COLUMN IF NOT EXISTS site_names JSONB;

-- Comment: Stores array of site names used when generating the report
-- Example: ["Site A", "Site B"] or null for "All Sites"
