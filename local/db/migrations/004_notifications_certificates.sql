-- 004_notifications_certificates.sql
-- FR-08 (in-app notification channel) + gamification: certificates & badges
-- Owner: Member 5 - EG/2021/4580 Jayasri M.S.P.D.R.
--
-- Idempotent. Mirrored verbatim in azure/db/migrations/.
-- Both table names are registered in azure/backend/src/db/pool.js expectedTables;
-- the Key Vault `db-schema` secret must be refreshed before this reaches an
-- existing Azure database (rule B3).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Notifications ────────────────────────────────────────────────────────────
-- The in-app half of FR-08. The email half already exists (emailService); this
-- table is the second channel, not a replacement for it.
CREATE TABLE IF NOT EXISTS notifications (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(150) NOT NULL,
    message    TEXT NOT NULL,
    -- Deliberately no CHECK constraint: other members add notification types as
    -- they land features, and a CHECK here would make every new type a migration.
    type       VARCHAR(40) NOT NULL,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backs both the unread-count poll and the dropdown list, which are the only
-- two queries the bell ever runs.
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
    ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created
    ON notifications(user_id, created_at DESC);

-- ── Certificates ─────────────────────────────────────────────────────────────
-- Issued once per volunteer per event, after the event is CLOSED and the
-- volunteer has verified hours > 0 (see certificateController.issueEligible).
CREATE TABLE IF NOT EXISTS certificates (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    -- Random, never sequential: this is the only value a third party needs to
    -- hit the public verification endpoint, so it must not be enumerable.
    certificate_code VARCHAR(32) NOT NULL UNIQUE,
    total_hours      NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (total_hours >= 0),
    issued_at        TIMESTAMPTZ DEFAULT NOW(),
    -- One certificate per volunteer per event, even when the volunteer held two
    -- roles in that event (two attendance rows, one certificate).
    UNIQUE(user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_certificates_user ON certificates(user_id);
