CREATE TABLE dndshare.battle_map_preview (
    id bigserial PRIMARY KEY,
    map_id uuid UNIQUE REFERENCES dndshare.battle_map(id) ON DELETE CASCADE,
    system_id varchar(80) UNIQUE,
    signature char(64) NOT NULL CHECK (signature ~ '^[0-9a-f]{64}$'),
    object_key text NOT NULL UNIQUE,
    file_size bigint NOT NULL CHECK (file_size > 0),
    changed_at timestamptz NOT NULL DEFAULT now(),
    CHECK ((map_id IS NOT NULL) <> (system_id IS NOT NULL))
);
