CREATE TABLE dndshare.session (
    id            BIGSERIAL PRIMARY KEY,
    uuid          UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    owner_user_id BIGINT NOT NULL,
    name          VARCHAR(255) NOT NULL,
    description   TEXT,
    system        VARCHAR(64),
    invite_code   VARCHAR(16) UNIQUE NOT NULL,
    status        VARCHAR(32) NOT NULL DEFAULT 'active',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted       BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE dndshare.session_participant (
    id         BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES dndshare.session(id),
    char_id    BIGINT NOT NULL REFERENCES dndshare.char(id),
    user_id    BIGINT NOT NULL,
    role       VARCHAR(32) NOT NULL DEFAULT 'player',
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, char_id)
);

CREATE TABLE dndshare.session_event (
    id             BIGSERIAL PRIMARY KEY,
    session_id     BIGINT NOT NULL REFERENCES dndshare.session(id),
    author_user_id BIGINT NOT NULL,
    event_type     VARCHAR(32) NOT NULL,
    title          VARCHAR(255),
    content        TEXT,
    data           JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted        BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE dndshare.session_encounter (
    id         BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES dndshare.session(id),
    name       VARCHAR(255),
    status     VARCHAR(32) NOT NULL DEFAULT 'pending',
    round      INT NOT NULL DEFAULT 0,
    data       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted    BOOLEAN NOT NULL DEFAULT false
);
