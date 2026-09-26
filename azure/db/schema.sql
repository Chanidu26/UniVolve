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
    created_at TIMESTAMPTZ DEFAULT NOW()
);
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

-- system_role is synchronized from the verified Entra app-role claim on login.
