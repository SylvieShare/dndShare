CREATE TABLE dndshare.session_global_map (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id bigint NOT NULL REFERENCES dndshare.session(id) ON DELETE CASCADE,
    name varchar(160) NOT NULL,
    image_id bigint NOT NULL REFERENCES dndshare.storage_image(id),
    routes jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(routes) = 'array'),
    is_current boolean NOT NULL DEFAULT false,
    revision bigint NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX session_global_map_session_idx ON dndshare.session_global_map(session_id);
CREATE INDEX session_global_map_image_idx ON dndshare.session_global_map(image_id);
CREATE UNIQUE INDEX session_global_map_current_idx ON dndshare.session_global_map(session_id) WHERE is_current;
