-- ---------------------------------------------------------------------------
-- Session world: a hierarchical place catalogue and prepared NPCs.
-- Locations deliberately have no graph edges: geography is represented only
-- by parent/child nesting and sibling order.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.session_location (
    id                 bigserial NOT NULL,
    session_id         int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    parent_location_id int8 NULL REFERENCES dndshare.session_location(id) ON DELETE RESTRICT,
    "name"             varchar(160) NOT NULL,
    kind               varchar(32) DEFAULT 'other' NOT NULL,
    description        text NULL,
    image_preset_key   varchar(64) NULL,
    sort_order         int4 DEFAULT 0 NOT NULL,
    created_at         timestamptz DEFAULT now() NOT NULL,
    changed_at         timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_location_pkey PRIMARY KEY (id),
    CONSTRAINT session_location_not_own_parent CHECK (parent_location_id IS NULL OR parent_location_id <> id),
    CONSTRAINT session_location_kind_check CHECK (
        kind IN ('region', 'settlement', 'district', 'building', 'room', 'wilderness', 'dungeon', 'other')
    )
);
CREATE INDEX IF NOT EXISTS idx_session_location_session_order
    ON dndshare.session_location USING btree (session_id, parent_location_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_session_location_parent
    ON dndshare.session_location USING btree (parent_location_id);
ALTER TABLE dndshare.session_location ADD COLUMN IF NOT EXISTS image_preset_key varchar(64) NULL;

CREATE TABLE IF NOT EXISTS dndshare.session_npc (
    id          bigserial NOT NULL,
    session_id  int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    "name"      varchar(160) NOT NULL,
    race_item_id int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL,
    role        varchar(160) NULL,
    description text NULL,
    color       varchar(7) DEFAULT '#7c5cff' NOT NULL,
    image_preset_key varchar(64) DEFAULT 'npc-scholar' NULL,
    custom_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL,
    image_focal_x float8 DEFAULT 0.5 NOT NULL,
    image_focal_y float8 DEFAULT 0.5 NOT NULL,
    sort_order  int4 DEFAULT 0 NOT NULL,
    created_at  timestamptz DEFAULT now() NOT NULL,
    changed_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_npc_pkey PRIMARY KEY (id),
    CONSTRAINT session_npc_image_source_check CHECK (
        NOT (image_preset_key IS NOT NULL AND custom_image_id IS NOT NULL)
    )
);
ALTER TABLE dndshare.session_npc
    ADD COLUMN IF NOT EXISTS race_item_id int8 NULL REFERENCES dndshare.item(id) ON DELETE SET NULL;
ALTER TABLE dndshare.session_npc ADD COLUMN IF NOT EXISTS image_preset_key varchar(64) NULL;
ALTER TABLE dndshare.session_npc ADD COLUMN IF NOT EXISTS custom_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;
ALTER TABLE dndshare.session_npc ADD COLUMN IF NOT EXISTS image_focal_x float8 DEFAULT 0.5 NOT NULL;
ALTER TABLE dndshare.session_npc ADD COLUMN IF NOT EXISTS image_focal_y float8 DEFAULT 0.5 NOT NULL;
UPDATE dndshare.session_npc SET image_preset_key = 'npc-scholar'
WHERE image_preset_key IS NULL AND custom_image_id IS NULL;
ALTER TABLE dndshare.session_npc ALTER COLUMN image_preset_key SET DEFAULT 'npc-scholar';
DO $$ BEGIN
    ALTER TABLE dndshare.session_npc ADD CONSTRAINT session_npc_image_source_check
        CHECK (NOT (image_preset_key IS NOT NULL AND custom_image_id IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS idx_session_npc_session_order
    ON dndshare.session_npc USING btree (session_id, sort_order, id);
