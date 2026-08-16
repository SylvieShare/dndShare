-- ---------------------------------------------------------------------------
-- Quests and universal relations between reusable session entities.
-- Relation endpoints are stored in a canonical order, so every relation is
-- undirected and can be edited from either side without creating duplicates.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.session_quest (
    id          bigserial NOT NULL,
    session_id  int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    "name"      varchar(160) NOT NULL,
    status      varchar(24) DEFAULT 'planned' NOT NULL,
    goal        text NULL,
    condition_text text NULL,
    reward      text NULL,
    consequences text NULL,
    notes       text NULL,
    sort_order  int4 DEFAULT 0 NOT NULL,
    created_at  timestamptz DEFAULT now() NOT NULL,
    changed_at  timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_quest_pkey PRIMARY KEY (id),
    CONSTRAINT session_quest_status_check CHECK (
        status IN ('planned', 'active', 'completed', 'failed')
    )
);
ALTER TABLE dndshare.session_quest ADD COLUMN IF NOT EXISTS goal text NULL;
ALTER TABLE dndshare.session_quest ADD COLUMN IF NOT EXISTS condition_text text NULL;
ALTER TABLE dndshare.session_quest ADD COLUMN IF NOT EXISTS reward text NULL;
ALTER TABLE dndshare.session_quest ADD COLUMN IF NOT EXISTS consequences text NULL;
ALTER TABLE dndshare.session_quest ADD COLUMN IF NOT EXISTS notes text NULL;

-- The former catch-all description becomes master notes, preserving existing
-- quest text while moving the current schema to explicit semantic fields.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare'
          AND table_name = 'session_quest'
          AND column_name = 'description'
    ) THEN
        EXECUTE 'UPDATE dndshare.session_quest SET notes = description WHERE notes IS NULL AND description IS NOT NULL';
    END IF;
END $$;
ALTER TABLE dndshare.session_quest DROP COLUMN IF EXISTS description;

CREATE INDEX IF NOT EXISTS idx_session_quest_session_order
    ON dndshare.session_quest USING btree (session_id, sort_order, id);

CREATE TABLE IF NOT EXISTS dndshare.session_entity_relation (
    session_id int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    left_type  varchar(16) NOT NULL,
    left_id    int8 NOT NULL,
    right_type varchar(16) NOT NULL,
    right_id   int8 NOT NULL,
    note       varchar(500) NULL,
    CONSTRAINT session_entity_relation_pkey
        PRIMARY KEY (session_id, left_type, left_id, right_type, right_id),
    CONSTRAINT session_entity_relation_left_type_check
        CHECK (left_type IN ('location', 'npc', 'material', 'quest', 'scene')),
    CONSTRAINT session_entity_relation_right_type_check
        CHECK (right_type IN ('location', 'npc', 'material', 'quest', 'scene')),
    CONSTRAINT session_entity_relation_order_check
        CHECK (ROW(left_type, left_id) < ROW(right_type, right_id))
);
ALTER TABLE dndshare.session_entity_relation
    DROP CONSTRAINT IF EXISTS session_entity_relation_left_type_check;
ALTER TABLE dndshare.session_entity_relation
    DROP CONSTRAINT IF EXISTS session_entity_relation_right_type_check;
ALTER TABLE dndshare.session_entity_relation
    ADD CONSTRAINT session_entity_relation_left_type_check
        CHECK (left_type IN ('location', 'npc', 'material', 'quest', 'scene'));
ALTER TABLE dndshare.session_entity_relation
    ADD CONSTRAINT session_entity_relation_right_type_check
        CHECK (right_type IN ('location', 'npc', 'material', 'quest', 'scene'));
CREATE INDEX IF NOT EXISTS idx_session_entity_relation_right
    ON dndshare.session_entity_relation USING btree (session_id, right_type, right_id);

-- Preserve existing NPC/location and NPC/NPC relations.
DO $$ BEGIN
    IF to_regclass('dndshare.session_npc_location') IS NOT NULL THEN
        INSERT INTO dndshare.session_entity_relation (
            session_id, left_type, left_id, right_type, right_id, note
        )
        SELECT npc.session_id, 'location', link.location_id, 'npc', npc.id, left(link.note, 500)
        FROM dndshare.session_npc_location link
        JOIN dndshare.session_npc npc ON npc.id = link.npc_id
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

DO $$ BEGIN
    IF to_regclass('dndshare.session_npc_relation') IS NOT NULL THEN
        INSERT INTO dndshare.session_entity_relation (
            session_id, left_type, left_id, right_type, right_id, note
        )
        SELECT npc.session_id, 'npc', relation.left_npc_id, 'npc', relation.right_npc_id, left(relation.note, 500)
        FROM dndshare.session_npc_relation relation
        JOIN dndshare.session_npc npc ON npc.id = relation.left_npc_id
        ON CONFLICT DO NOTHING;
    END IF;
END $$;

-- Move every former scenario association into the universal model. Dynamic
-- SQL keeps this startup migration safe after the legacy tables are dropped.
DO $$ BEGIN
    IF to_regclass('dndshare.session_scene_location') IS NOT NULL THEN
        EXECUTE $migration$
            INSERT INTO dndshare.session_entity_relation
                (session_id, left_type, left_id, right_type, right_id, note)
            SELECT location.session_id, 'location', link.location_id, 'scene', link.scene_id, NULL
            FROM dndshare.session_scene_location link
            JOIN dndshare.session_location location ON location.id = link.location_id
            ON CONFLICT DO NOTHING
        $migration$;
    END IF;
END $$;

DO $$ BEGIN
    IF to_regclass('dndshare.session_npc_scene') IS NOT NULL THEN
        EXECUTE $migration$
            INSERT INTO dndshare.session_entity_relation
                (session_id, left_type, left_id, right_type, right_id, note)
            SELECT npc.session_id, 'npc', link.npc_id, 'scene', link.scene_id, left(link.note, 500)
            FROM dndshare.session_npc_scene link
            JOIN dndshare.session_npc npc ON npc.id = link.npc_id
            ON CONFLICT DO NOTHING
        $migration$;
    END IF;
END $$;

DO $$ BEGIN
    IF to_regclass('dndshare.session_material_scene') IS NOT NULL THEN
        EXECUTE $migration$
            INSERT INTO dndshare.session_entity_relation
                (session_id, left_type, left_id, right_type, right_id, note)
            SELECT material.session_id, 'material', link.material_id, 'scene', link.scene_id, left(link.note, 500)
            FROM dndshare.session_material_scene link
            JOIN dndshare.session_material material ON material.id = link.material_id
            ON CONFLICT DO NOTHING
        $migration$;
    END IF;
END $$;

-- Very old material rows may still store their context directly.
DO $$ BEGIN
    IF (
        SELECT count(*) = 2 FROM information_schema.columns
        WHERE table_schema = 'dndshare'
          AND table_name = 'session_material'
          AND column_name IN ('scope', 'scene_id')
    ) THEN
        EXECUTE $migration$
            INSERT INTO dndshare.session_entity_relation
                (session_id, left_type, left_id, right_type, right_id, note)
            SELECT session_id, 'material', id, 'scene', scene_id, NULL
            FROM dndshare.session_material
            WHERE scope = 'scene' AND scene_id IS NOT NULL
            ON CONFLICT DO NOTHING
        $migration$;
    END IF;
END $$;

-- The universal table is now authoritative. Dropping the legacy tables also
-- prevents the startup migration above from restoring a relation that the DM
-- removed after the first successful migration.
DROP TABLE IF EXISTS dndshare.session_npc_location;
DROP TABLE IF EXISTS dndshare.session_npc_relation;
DROP TABLE IF EXISTS dndshare.session_scene_location;
DROP TABLE IF EXISTS dndshare.session_npc_scene;
DROP TABLE IF EXISTS dndshare.session_material_scene;
DROP TABLE IF EXISTS dndshare.session_material_chapter;

ALTER TABLE dndshare.session_material DROP CONSTRAINT IF EXISTS session_material_context_check;
ALTER TABLE dndshare.session_material DROP CONSTRAINT IF EXISTS session_material_scope_check;
ALTER TABLE dndshare.session_material
    DROP COLUMN IF EXISTS scope,
    DROP COLUMN IF EXISTS chapter_id,
    DROP COLUMN IF EXISTS scene_id;
