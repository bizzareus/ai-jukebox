-- Add created_by_admin_id to gtm_leads (optional; for analytics)
ALTER TABLE gtm_leads
  ADD COLUMN IF NOT EXISTS created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_gtm_leads_created_by ON gtm_leads(created_by_admin_id);
