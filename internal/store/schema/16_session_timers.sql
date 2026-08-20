-- ---------------------------------------------------------------------------
-- Persistent DM timers shown in the session workspace.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.session_timer (
    id            bigserial NOT NULL,
    session_id    int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    description   varchar(160) NOT NULL,
    duration_ms   int8 NOT NULL,
    ends_at       timestamptz NULL,
    remaining_ms  int8 NULL,
    paused        bool DEFAULT false NOT NULL,
    broadcast     bool DEFAULT false NOT NULL,
    created_at    timestamptz DEFAULT now() NOT NULL,
    changed_at    timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_timer_pk PRIMARY KEY (id),
    CONSTRAINT session_timer_duration_check CHECK (duration_ms BETWEEN 1000 AND 604800000),
    CONSTRAINT session_timer_state_check CHECK (
        (paused = true AND ends_at IS NULL AND remaining_ms IS NOT NULL AND remaining_ms >= 0)
        OR
        (paused = false AND ends_at IS NOT NULL AND remaining_ms IS NULL)
    )
);

ALTER TABLE dndshare.session_timer
    ADD COLUMN IF NOT EXISTS broadcast bool DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_timer_session_id
    ON dndshare.session_timer USING btree (session_id, id);
