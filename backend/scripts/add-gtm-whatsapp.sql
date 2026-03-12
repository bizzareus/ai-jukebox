-- GTM WhatsApp outbound: conversations and messages (WasenderAPI + OpenAI replies)
CREATE TABLE IF NOT EXISTS gtm_whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone VARCHAR(20) NOT NULL,
  bar_name VARCHAR(500),
  created_by_admin_id UUID,
  onboarded_venue_id UUID REFERENCES venues(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gtm_whatsapp_conversations_phone ON gtm_whatsapp_conversations(phone);
CREATE INDEX IF NOT EXISTS idx_gtm_whatsapp_conversations_updated_at ON gtm_whatsapp_conversations(updated_at);

CREATE TABLE IF NOT EXISTS gtm_whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES gtm_whatsapp_conversations(id) ON DELETE CASCADE,
  direction VARCHAR(3) NOT NULL CHECK (direction IN ('in', 'out')),
  body TEXT NOT NULL,
  external_id VARCHAR(100),
  is_ai_reply BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gtm_whatsapp_messages_conversation_id ON gtm_whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_gtm_whatsapp_messages_external_id ON gtm_whatsapp_messages(external_id) WHERE external_id IS NOT NULL;
