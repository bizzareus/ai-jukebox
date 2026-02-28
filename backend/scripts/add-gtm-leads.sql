-- GTM leads: store place and onboarding email status for analytics
CREATE TABLE IF NOT EXISTS gtm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id VARCHAR(255),
  place_name VARCHAR(500),
  address TEXT,
  phone VARCHAR(100),
  website TEXT,
  email VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'sent',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_gtm_leads_status ON gtm_leads(status);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_sent_at ON gtm_leads(sent_at);
CREATE INDEX IF NOT EXISTS idx_gtm_leads_created_by ON gtm_leads(created_by_admin_id);
