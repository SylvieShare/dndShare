CREATE TABLE dndshare.user_tutorial (
    user_id int8 NOT NULL REFERENCES dndshare.users(id) ON DELETE CASCADE,
    flow_id text NOT NULL CHECK (flow_id IN ('character', 'session-player', 'session-dm')),
    source_key text NOT NULL CHECK (source_key ~ '^(source:[1-9][0-9]*|edition:[1-9][0-9]*|unassigned)$'),
    device text NOT NULL CHECK (device IN ('desktop', 'mobile')),
    revision int NOT NULL CHECK (revision > 0),
    status text NOT NULL CHECK (status IN ('completed', 'dismissed')),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, flow_id, source_key, device)
);
