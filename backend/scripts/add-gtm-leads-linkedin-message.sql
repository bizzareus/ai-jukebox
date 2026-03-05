-- Add LinkedIn message to GTM leads (for copy-paste outreach).
ALTER TABLE gtm_leads ADD COLUMN IF NOT EXISTS linkedin_message TEXT;
