BEGIN;

CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL, 
    CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

-- Running upgrade  -> 001

CREATE TABLE "user" (
    display_name VARCHAR(100), 
    avatar_url TEXT, 
    id UUID NOT NULL, 
    email VARCHAR(320) NOT NULL, 
    hashed_password VARCHAR(1024) NOT NULL, 
    is_active BOOLEAN DEFAULT true NOT NULL, 
    is_superuser BOOLEAN DEFAULT false NOT NULL, 
    is_verified BOOLEAN DEFAULT false NOT NULL, 
    PRIMARY KEY (id)
);

CREATE UNIQUE INDEX ix_user_email ON "user" (email);

CREATE TABLE oauth_account (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    oauth_name VARCHAR(100) NOT NULL, 
    access_token VARCHAR(1024) NOT NULL, 
    expires_at INTEGER, 
    refresh_token VARCHAR(1024), 
    account_id VARCHAR(320) NOT NULL, 
    account_email VARCHAR(320) NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX ix_oauth_account_account_id ON oauth_account (account_id);

CREATE INDEX ix_oauth_account_oauth_name ON oauth_account (oauth_name);

CREATE TABLE sessions (
    id UUID NOT NULL, 
    user_id UUID NOT NULL, 
    token_hash VARCHAR(64) NOT NULL, 
    device_info VARCHAR(256) DEFAULT '' NOT NULL, 
    ip_address VARCHAR(45), 
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL, 
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    is_revoked BOOLEAN DEFAULT false NOT NULL, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
    PRIMARY KEY (id), 
    FOREIGN KEY(user_id) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX ix_sessions_user_id ON sessions (user_id);

CREATE UNIQUE INDEX ix_sessions_token_hash ON sessions (token_hash);

INSERT INTO alembic_version (version_num) VALUES ('001') RETURNING alembic_version.version_num;

-- Running upgrade 001 -> 002

ALTER TABLE sessions ADD COLUMN family_id UUID;

ALTER TABLE sessions ADD COLUMN parent_hash VARCHAR(64);

ALTER TABLE sessions ADD COLUMN revoked_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE sessions ADD COLUMN user_agent VARCHAR(512);

UPDATE sessions SET family_id = id WHERE family_id IS NULL;

ALTER TABLE sessions ALTER COLUMN family_id SET NOT NULL;

CREATE INDEX ix_sessions_family_id ON sessions (family_id);

CREATE INDEX ix_sessions_revoked_at ON sessions (revoked_at);

UPDATE alembic_version SET version_num='002' WHERE alembic_version.version_num = '001';

COMMIT;

