-- VMS Database Schema (aligned to CA01 Class Diagram)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),              -- local auth only; NULL when using AD B2C
    b2c_object_id VARCHAR(100) UNIQUE,       -- adb2cObjectId
    full_name VARCHAR(150) NOT NULL,
    system_role VARCHAR(20) NOT NULL DEFAULT 'VOLUNTEER'
        CHECK (system_role IN ('VOLUNTEER','SUPER_ADMIN')),
    bio TEXT,
    skills TEXT[] DEFAULT '{}',
    portfolio_links TEXT[] DEFAULT '{}',
    profile_picture_url VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_date TIMESTAMPTZ NOT NULL,
    location VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT'
        CHECK (status IN ('DRAFT','PUBLISHED','CLOSED')),
    created_by UUID NOT NULL REFERENCES users(id),
    organizer_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);

CREATE TABLE event_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    role_name VARCHAR(100) NOT NULL,
    description TEXT,
    total_slots INT NOT NULL CHECK (total_slots > 0),
    filled_slots INT NOT NULL DEFAULT 0 CHECK (filled_slots >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, role_name),
    CHECK (filled_slots <= total_slots)
);

CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_role_id UUID NOT NULL REFERENCES event_roles(id) ON DELETE CASCADE,
    volunteer_id UUID NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    decided_at TIMESTAMPTZ,
    UNIQUE(event_role_id, volunteer_id)       -- isDuplicate()
);
CREATE INDEX idx_apps_volunteer ON applications(volunteer_id);
CREATE INDEX idx_apps_status ON applications(status);

-- Promote first admin after their first B2C login:
-- UPDATE users SET system_role='SUPER_ADMIN' WHERE email='admin@university.lk';
