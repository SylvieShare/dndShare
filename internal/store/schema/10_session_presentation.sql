-- ---------------------------------------------------------------------------
-- Player presentation screen and reusable session materials.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.session_material (
    id         bigserial NOT NULL,
    session_id int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    scope      varchar(16) DEFAULT 'session' NOT NULL,
    chapter_id int8 NULL REFERENCES dndshare.session_chapter(id) ON DELETE CASCADE,
    scene_id   int8 NULL REFERENCES dndshare.session_scene(id) ON DELETE CASCADE,
    kind       varchar(16) DEFAULT 'image' NOT NULL,
    "name"     varchar(160) NOT NULL,
    caption    text NULL,
    image_id   int8 NOT NULL REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_material_pk PRIMARY KEY (id),
    CONSTRAINT session_material_scope_check CHECK (scope IN ('session', 'chapter', 'scene')),
    CONSTRAINT session_material_kind_check CHECK (kind IN ('image')),
    CONSTRAINT session_material_context_check CHECK (
        (scope = 'session' AND chapter_id IS NULL AND scene_id IS NULL)
        OR (scope = 'chapter' AND chapter_id IS NOT NULL AND scene_id IS NULL)
        OR (scope = 'scene' AND chapter_id IS NOT NULL AND scene_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS idx_session_material_session_id
    ON dndshare.session_material USING btree (session_id);
CREATE INDEX IF NOT EXISTS idx_session_material_chapter_id
    ON dndshare.session_material USING btree (chapter_id) WHERE chapter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_material_scene_id
    ON dndshare.session_material USING btree (scene_id) WHERE scene_id IS NOT NULL;

ALTER TABLE dndshare.session_scene
    ADD COLUMN IF NOT EXISTS presentation_material_id int8 NULL,
    ADD COLUMN IF NOT EXISTS presentation_track_id int8 NULL,
    ADD COLUMN IF NOT EXISTS presentation_volume float8 NULL,
    ADD COLUMN IF NOT EXISTS presentation_crossfade_sec float8 NULL,
    ADD COLUMN IF NOT EXISTS presentation_effect varchar(24) DEFAULT 'none' NOT NULL,
    ADD COLUMN IF NOT EXISTS presentation_transition varchar(16) DEFAULT 'fade' NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_scene_presentation_material_fk') THEN
        ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_presentation_material_fk
            FOREIGN KEY (presentation_material_id) REFERENCES dndshare.session_material(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_scene_presentation_track_fk') THEN
        ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_presentation_track_fk
            FOREIGN KEY (presentation_track_id) REFERENCES dndshare.music_track(id) ON DELETE SET NULL;
    END IF;
END $$;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_effect_check;
ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_presentation_effect_check CHECK (
    presentation_effect IN ('none', 'rain', 'fog', 'embers', 'snow', 'storm')
);
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_transition_check;
ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_presentation_transition_check CHECK (
    presentation_transition IN ('cut', 'fade')
);
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_volume_check;
ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_presentation_volume_check CHECK (
    presentation_volume IS NULL OR (presentation_volume >= 0 AND presentation_volume <= 1)
);
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_crossfade_check;
ALTER TABLE dndshare.session_scene ADD CONSTRAINT session_scene_presentation_crossfade_check CHECK (
    presentation_crossfade_sec IS NULL OR (presentation_crossfade_sec >= 0 AND presentation_crossfade_sec <= 15)
);

ALTER TABLE dndshare.session_scene_item ADD COLUMN IF NOT EXISTS material_id int8 NULL;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_scene_item_material_fk') THEN
        ALTER TABLE dndshare.session_scene_item ADD CONSTRAINT session_scene_item_material_fk
            FOREIGN KEY (material_id) REFERENCES dndshare.session_material(id) ON DELETE RESTRICT;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_session_scene_item_material_id
    ON dndshare.session_scene_item USING btree (material_id) WHERE material_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS dndshare.session_presentation_state (
    session_id int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    mode       varchar(16) DEFAULT 'idle' NOT NULL,
    visible    bool DEFAULT false NOT NULL,
    material_id int8 NULL REFERENCES dndshare.session_material(id) ON DELETE SET NULL,
    scene_id   int8 NULL REFERENCES dndshare.session_scene(id) ON DELETE SET NULL,
    effect     varchar(24) DEFAULT 'none' NOT NULL,
    transition varchar(16) DEFAULT 'fade' NOT NULL,
    revision   int8 DEFAULT 0 NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_presentation_state_pk PRIMARY KEY (session_id),
    CONSTRAINT session_presentation_mode_check CHECK (mode IN ('idle', 'material', 'scene', 'combat')),
    CONSTRAINT session_presentation_effect_check CHECK (effect IN ('none', 'rain', 'fog', 'embers', 'snow', 'storm')),
    CONSTRAINT session_presentation_transition_check CHECK (transition IN ('cut', 'fade'))
);

INSERT INTO dndshare.session_presentation_state (session_id)
SELECT id FROM dndshare."session" WHERE deleted = false
ON CONFLICT (session_id) DO NOTHING;
