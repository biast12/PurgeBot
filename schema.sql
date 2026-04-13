-- PurgeBot PostgreSQL Schema

CREATE TABLE IF NOT EXISTS errors (
    id           INTEGER      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timestamp    TIMESTAMPTZ  NOT NULL,
    level        VARCHAR(8)   NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
    area         VARCHAR(20)  NOT NULL,
    message      TEXT         NOT NULL,
    stack_trace  TEXT,
    guild_id     BIGINT,
    guild_name   VARCHAR(100),
    channel_id   BIGINT,
    channel_name VARCHAR(100),
    user_id      BIGINT,
    command      VARCHAR(50),
    context      JSONB
);

CREATE INDEX IF NOT EXISTS idx_errors_timestamp       ON errors (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_guild_timestamp ON errors (guild_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_level_timestamp ON errors (level, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_errors_area_timestamp  ON errors (area, timestamp DESC);

CREATE TABLE IF NOT EXISTS customizations (
    guild_id        BIGINT       PRIMARY KEY,
    bot_name        VARCHAR(32),
    bot_avatar      TEXT,
    remove_branding BOOLEAN      NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ  NOT NULL,
    updated_by      BIGINT       NOT NULL
);
