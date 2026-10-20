ALTER TABLE dndshare.battle_map ADD COLUMN published_at timestamp with time zone;
CREATE INDEX battle_map_published_at_idx ON dndshare.battle_map (published_at DESC) WHERE published_at IS NOT NULL;

CREATE TABLE dndshare.map_subscription (
    map_id uuid NOT NULL REFERENCES dndshare.battle_map(id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES dndshare.users(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (map_id, user_id)
);
CREATE INDEX map_subscription_user_idx ON dndshare.map_subscription(user_id, created_at DESC);
CREATE TABLE dndshare.map_rating (
    map_id uuid NOT NULL REFERENCES dndshare.battle_map(id) ON DELETE CASCADE,
    user_id bigint NOT NULL REFERENCES dndshare.users(id) ON DELETE CASCADE,
    rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    changed_at timestamp with time zone DEFAULT now() NOT NULL,
    PRIMARY KEY (map_id, user_id)
);

ALTER TABLE dndshare.battle_map_preview DROP CONSTRAINT battle_map_preview_check;
ALTER TABLE dndshare.battle_map_preview DROP COLUMN system_id;
ALTER TABLE dndshare.battle_map_preview ALTER COLUMN map_id SET NOT NULL;
ALTER TABLE dndshare.battle_map_preview DROP CONSTRAINT IF EXISTS map_preview_retirement_guard;
