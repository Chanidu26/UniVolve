-- 003_event_discovery.sql
-- FR-04 Advanced Event Discovery / NFR-01 Search & Filtering
-- Owner: Member 3
--
-- Idempotent. Mirrored verbatim in azure/db/migrations/.
-- Adds category, tags, banner_image_url to events table plus search indexes.
-- NOTE: capacity is NOT added here — it is derived from event_roles.total_slots.

-- New columns on events
ALTER TABLE events ADD COLUMN IF NOT EXISTS category VARCHAR(50)
    CHECK (category IN ('Community Service','Environmental','Health','Education','Other'));

ALTER TABLE events ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

ALTER TABLE events ADD COLUMN IF NOT EXISTS banner_image_url VARCHAR(500);

-- Index for category filtering
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);

-- Full-text search index on title + description (GIN / tsvector)
CREATE INDEX IF NOT EXISTS idx_events_search
    ON events USING GIN (to_tsvector('english', COALESCE(title,'') || ' ' || COALESCE(description,'')));
