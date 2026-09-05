-- 002_attendance.sql
-- FR-06 Attendance Tracking / FR-07 Hours Verification & Dashboard
-- Owner: Member 2 - EG/2021/4632 Kumarasinghe K.K.R (Kavishka)
--
-- Idempotent. Mirrored verbatim in azure/db/migrations/.
-- Registered in azure/backend/src/db/pool.js expectedTables; the Key Vault
-- `db-schema` secret must be refreshed before this reaches an existing Azure DB.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS attendance (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- one attendance record per approved application
    application_id  UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
    -- denormalised for cheap per-event and per-volunteer lookups
    event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    volunteer_id    UUID NOT NULL REFERENCES users(id),
    check_in_time   TIMESTAMPTZ,
    check_out_time  TIMESTAMPTZ,
    hours_logged    NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (hours_logged >= 0),
    status          VARCHAR(20) NOT NULL DEFAULT 'PRESENT'
                    CHECK (status IN ('PRESENT','ABSENT','EXCUSED')),
    -- verified_at IS NOT NULL is what makes hours count
    verified_by     UUID REFERENCES users(id),
    verified_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_attendance_window CHECK (
        check_in_time IS NULL OR check_out_time IS NULL OR check_out_time >= check_in_time
    )
);

CREATE INDEX IF NOT EXISTS idx_attendance_volunteer ON attendance(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_attendance_event     ON attendance(event_id);

-- Backs GET /api/users/me/hours and Member 4's hours aggregate.
CREATE INDEX IF NOT EXISTS idx_attendance_verified
    ON attendance(volunteer_id) WHERE verified_at IS NOT NULL;
