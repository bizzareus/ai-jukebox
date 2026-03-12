-- Add onboard flow columns to gtm_whatsapp_conversations (run if table already exists).
ALTER TABLE gtm_whatsapp_conversations ADD COLUMN IF NOT EXISTS created_by_admin_id UUID;
ALTER TABLE gtm_whatsapp_conversations ADD COLUMN IF NOT EXISTS onboarded_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL;
