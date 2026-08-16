-- ---------------------------------------------------------------------------
-- Reusable materials use explicit many-to-many context links. An unlinked
-- material remains session-wide; legacy chapter/scene scopes are migrated once.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.session_material_chapter (
    material_id int8 NOT NULL REFERENCES dndshare.session_material(id) ON DELETE CASCADE,
    chapter_id  int8 NOT NULL REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE,
    note        varchar(500) NULL,
    CONSTRAINT session_material_chapter_pk PRIMARY KEY (material_id, chapter_id)
);
CREATE INDEX IF NOT EXISTS idx_session_material_chapter_chapter_id
    ON dndshare.session_material_chapter USING btree (chapter_id);

CREATE TABLE IF NOT EXISTS dndshare.session_material_scene (
    material_id int8 NOT NULL REFERENCES dndshare.session_material(id) ON DELETE CASCADE,
    scene_id    int8 NOT NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    note        varchar(500) NULL,
    CONSTRAINT session_material_scene_pk PRIMARY KEY (material_id, scene_id)
);
CREATE INDEX IF NOT EXISTS idx_session_material_scene_scene_id
    ON dndshare.session_material_scene USING btree (scene_id);

DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare' AND table_name = 'session_material' AND column_name = 'scope'
    ) THEN
        INSERT INTO dndshare.session_material_chapter (material_id, chapter_id)
        SELECT id, chapter_id
        FROM dndshare.session_material
        WHERE scope = 'chapter' AND chapter_id IS NOT NULL
        ON CONFLICT (material_id, chapter_id) DO NOTHING;

        INSERT INTO dndshare.session_material_scene (material_id, scene_id)
        SELECT id, scene_id
        FROM dndshare.session_material
        WHERE scope = 'scene' AND scene_id IS NOT NULL
        ON CONFLICT (material_id, scene_id) DO NOTHING;
    END IF;
END $$;

ALTER TABLE dndshare.session_material DROP CONSTRAINT IF EXISTS session_material_context_check;
ALTER TABLE dndshare.session_material DROP CONSTRAINT IF EXISTS session_material_scope_check;
ALTER TABLE dndshare.session_material
    DROP COLUMN IF EXISTS scope,
    DROP COLUMN IF EXISTS chapter_id,
    DROP COLUMN IF EXISTS scene_id;
