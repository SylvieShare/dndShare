CREATE INDEX IF NOT EXISTS idx_users_session_created_at
    ON dndshare.users_session (created_at);

CREATE UNIQUE INDEX IF NOT EXISTS users_session_token_uindex
    ON dndshare.users_session ("session");
