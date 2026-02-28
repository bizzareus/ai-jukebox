-- Push subscriptions for web push (admin: new song queued; customer: your song is playing)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id UUID REFERENCES venues(id) ON DELETE CASCADE,
  order_id VARCHAR(255) UNIQUE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_venue_id ON push_subscriptions(venue_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_order_id ON push_subscriptions(order_id) WHERE order_id IS NOT NULL;
