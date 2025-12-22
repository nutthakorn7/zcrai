-- MDR Reports: Monthly report tracking per tenant
CREATE TABLE IF NOT EXISTS mdr_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  month_year VARCHAR(7) NOT NULL, -- Format: '2025-11'
  status TEXT DEFAULT 'draft' NOT NULL CHECK (status IN ('draft', 'approved', 'generating', 'sent', 'error')),
  pdf_url TEXT,
  download_token TEXT,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMP,
  sent_at TIMESTAMP,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
  UNIQUE(tenant_id, month_year)
);

-- MDR Report Snapshots: Versioned JSON data for reports
CREATE TABLE IF NOT EXISTS mdr_report_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES mdr_reports(id) ON DELETE CASCADE NOT NULL,
  version INTEGER DEFAULT 1 NOT NULL,
  data JSONB NOT NULL, -- Complete report data structure
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_mdr_reports_tenant_id ON mdr_reports(tenant_id);
CREATE INDEX IF NOT EXISTS idx_mdr_reports_status ON mdr_reports(status);
CREATE INDEX IF NOT EXISTS idx_mdr_reports_month_year ON mdr_reports(month_year);
CREATE INDEX IF NOT EXISTS idx_mdr_report_snapshots_report_id ON mdr_report_snapshots(report_id);
