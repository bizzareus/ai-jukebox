-- Add voting: vote_count on queue_items, queue_item_votes for one vote per session per item
-- Run: psql -d jukebox -f scripts/add-queue-voting.sql

ALTER TABLE queue_items ADD COLUMN IF NOT EXISTS vote_count INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS queue_item_votes (
  queue_item_id UUID NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
  session_id VARCHAR(255) NOT NULL,
  PRIMARY KEY (queue_item_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_queue_item_votes_queue_item_id ON queue_item_votes(queue_item_id);
