CREATE TABLE IF NOT EXISTS dndshare.battle_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_user_id bigint NOT NULL REFERENCES dndshare.users(id),
    name varchar(160) NOT NULL,
    document jsonb NOT NULL,
    asset_id bigint REFERENCES dndshare.storage_image(id),
    revision bigint NOT NULL DEFAULT 1,
    changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS battle_map_owner ON dndshare.battle_map(owner_user_id);
CREATE INDEX IF NOT EXISTS battle_map_asset ON dndshare.battle_map(asset_id) WHERE asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.session_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id bigint NOT NULL REFERENCES dndshare.session(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    document jsonb NOT NULL,
    asset_id bigint REFERENCES dndshare.storage_image(id),
    state jsonb NOT NULL,
    revision bigint NOT NULL DEFAULT 1,
    changed_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (session_id, id)
);
CREATE INDEX IF NOT EXISTS session_map_session ON dndshare.session_map(session_id);
CREATE INDEX IF NOT EXISTS session_map_asset ON dndshare.session_map(asset_id) WHERE asset_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.session_map_display (
    session_id bigint PRIMARY KEY REFERENCES dndshare.session(id) ON DELETE CASCADE,
    map_id uuid,
    visible boolean NOT NULL DEFAULT false,
    camera jsonb NOT NULL DEFAULT '{"x":0,"y":0,"cellPixels":64,"rotation":0,"fit":true}',
    revision bigint NOT NULL DEFAULT 0,
    FOREIGN KEY (session_id, map_id) REFERENCES dndshare.session_map(session_id, id)
);
