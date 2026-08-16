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

CREATE TABLE IF NOT EXISTS dndshare.session_npc (
    id          bigserial NOT NULL,
    session_id  int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    "name"      varchar(160) NOT NULL,
    role        varchar(160) NULL,
    description text NULL,
    color       varchar(7) DEFAULT '#7c5cff' NOT NULL,
    sort_order  int4 DEFAULT 0 NOT NULL,
    created_at  timestamptz DEFAULT now() NOT NULL,
    changed_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_npc_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_session_npc_session_order
    ON dndshare.session_npc USING btree (session_id, sort_order, id);

CREATE TABLE IF NOT EXISTS dndshare.session_scene_location (
    scene_id    int8 NOT NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    location_id int8 NOT NULL REFERENCES dndshare.session_location(id) ON DELETE CASCADE,
    CONSTRAINT session_scene_location_pkey PRIMARY KEY (scene_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_session_scene_location_location
    ON dndshare.session_scene_location USING btree (location_id);

CREATE TABLE IF NOT EXISTS dndshare.session_npc_location (
    npc_id      int8 NOT NULL REFERENCES dndshare.session_npc(id) ON DELETE CASCADE,
    location_id int8 NOT NULL REFERENCES dndshare.session_location(id) ON DELETE CASCADE,
    CONSTRAINT session_npc_location_pkey PRIMARY KEY (npc_id, location_id)
);
CREATE INDEX IF NOT EXISTS idx_session_npc_location_location
    ON dndshare.session_npc_location USING btree (location_id);

CREATE TABLE IF NOT EXISTS dndshare.session_npc_scene (
    npc_id   int8 NOT NULL REFERENCES dndshare.session_npc(id) ON DELETE CASCADE,
    scene_id int8 NOT NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    CONSTRAINT session_npc_scene_pkey PRIMARY KEY (npc_id, scene_id)
);
CREATE INDEX IF NOT EXISTS idx_session_npc_scene_scene
    ON dndshare.session_npc_scene USING btree (scene_id);
