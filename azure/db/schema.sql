-- VMS Database Schema (aligned to CA01 Class Diagram)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),              -- unused in azure/ (Google Sign-In only); local/ uses this for password auth
    b2c_object_id VARCHAR(100) UNIQUE,       -- external IdP subject id (Google's `sub` claim in azure/)
    full_name VARCHAR(150) NOT NULL,
    system_role VARCHAR(20) NOT NULL DEFAULT 'VOLUNTEER'
        CHECK (system_role IN ('VOLUNTEER','SUPER_ADMIN')),
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    portfolio_links TEXT[] DEFAULT '{}',
    profile_picture_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PUBLISHED','CLOSED')),
    image_url VARCHAR(500),
    created_by UUID NOT NULL REFERENCES users(id),
    organizer_id UUID REFERENCES users(id),
    attendance_code VARCHAR(32) UNIQUE NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE events ADD COLUMN IF NOT EXISTS attendance_code VARCHAR(32);
UPDATE events SET attendance_code = replace(gen_random_uuid()::text, '-', '') WHERE attendance_code IS NULL;
ALTER TABLE events ALTER COLUMN attendance_code SET DEFAULT replace(gen_random_uuid()::text, '-', '');
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_attendance_code ON events(attendance_code);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);

CREATE TABLE IF NOT EXISTS event_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    total_slots INT NOT NULL CHECK (total_slots > 0),
    filled_slots INT NOT NULL DEFAULT 0 CHECK (filled_slots >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, role_name),
    CHECK (filled_slots <= total_slots)
);

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_role_id UUID NOT NULL REFERENCES event_roles(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','APPROVED','REJECTED','INVITED')),
    origin VARCHAR(10) NOT NULL DEFAULT 'SELF'
        CHECK (origin IN ('SELF','INVITE')),  -- SELF = volunteer applied; INVITE = organizer invited
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    UNIQUE(event_role_id, volunteer_id)       -- isDuplicate()
);
CREATE INDEX IF NOT EXISTS idx_apps_volunteer ON applications(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);

CREATE TABLE IF NOT EXISTS attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL UNIQUE REFERENCES applications(id) ON DELETE CASCADE,
    check_in_at TIMESTAMPTZ,
    check_out_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (check_out_at IS NULL OR check_in_at IS NOT NULL),
    CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);
CREATE INDEX IF NOT EXISTS idx_attendance_check_in ON attendance(check_in_at);

CREATE TABLE IF NOT EXISTS event_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, volunteer_id)
);

CREATE TABLE IF NOT EXISTS skill_endorsements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organizer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    skill VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(volunteer_id, organizer_id, event_id, skill)
);
CREATE INDEX IF NOT EXISTS idx_endorsements_volunteer ON skill_endorsements(volunteer_id);

CREATE TABLE IF NOT EXISTS recommendations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recommended_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recommender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (length(trim(text)) BETWEEN 10 AND 1000),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(recommended_user_id, recommender_user_id),
    CHECK (recommended_user_id <> recommender_user_id)
);
CREATE INDEX IF NOT EXISTS idx_recommendations_user ON recommendations(recommended_user_id, created_at DESC);

-- system_role is synchronized from the verified Entra app-role claim on login.
