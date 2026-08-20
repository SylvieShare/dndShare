-- ---------------------------------------------------------------------------
-- Player presentation screen and reusable session materials.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.session_material (
    id         bigserial NOT NULL,
    session_id int8 NOT NULL REFERENCES dndshare."session"(id) ON DELETE CASCADE,
    kind       varchar(16) DEFAULT 'image' NOT NULL,
    "name"     varchar(160) NOT NULL,
    caption    text NULL,
    image_id   int8 NOT NULL REFERENCES dndshare.storage_image(id) ON DELETE RESTRICT,
    created_at timestamptz DEFAULT now() NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_material_pk PRIMARY KEY (id),
    CONSTRAINT session_material_kind_check CHECK (kind IN ('image'))
);
CREATE INDEX IF NOT EXISTS idx_session_material_session_id
    ON dndshare.session_material USING btree (session_id);

ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_effect_check;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_transition_check;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_volume_check;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_crossfade_check;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_material_fk;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT IF EXISTS session_scene_presentation_track_fk;
ALTER TABLE dndshare.session_scene
    DROP COLUMN IF EXISTS presentation_material_id,
    DROP COLUMN IF EXISTS presentation_track_id,
    DROP COLUMN IF EXISTS presentation_volume,
    DROP COLUMN IF EXISTS presentation_crossfade_sec,
    DROP COLUMN IF EXISTS presentation_effect,
    DROP COLUMN IF EXISTS presentation_transition;

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
    broadcast_music bool DEFAULT false NOT NULL,
    show_health bool DEFAULT false NOT NULL,
    health_display varchar(16) DEFAULT 'numbers' NOT NULL,
    show_graveyard bool DEFAULT false NOT NULL,
    display_scale int2 DEFAULT 100 NOT NULL,
    effect     varchar(24) DEFAULT 'none' NOT NULL,
    transition varchar(16) DEFAULT 'fade' NOT NULL,
    revision   int8 DEFAULT 0 NOT NULL,
    changed_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT session_presentation_state_pk PRIMARY KEY (session_id),
    CONSTRAINT session_presentation_mode_check CHECK (mode IN ('idle', 'material', 'combat')),
    CONSTRAINT session_presentation_health_display_check CHECK (health_display IN ('numbers', 'words')),
    CONSTRAINT session_presentation_display_scale_check CHECK (display_scale BETWEEN 75 AND 125),
    CONSTRAINT session_presentation_effect_check CHECK (effect IN ('none', 'rain', 'fog', 'embers', 'snow', 'storm')),
    CONSTRAINT session_presentation_transition_check CHECK (transition IN ('cut', 'fade'))
);
ALTER TABLE dndshare.session_presentation_state
    ADD COLUMN IF NOT EXISTS broadcast_music bool DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS show_health bool DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS health_display varchar(16) DEFAULT 'numbers' NOT NULL,
    ADD COLUMN IF NOT EXISTS show_graveyard bool DEFAULT false NOT NULL,
    ADD COLUMN IF NOT EXISTS display_scale int2 DEFAULT 100 NOT NULL;

UPDATE dndshare.session_presentation_state
SET health_display = 'numbers'
WHERE health_display NOT IN ('numbers', 'words');
ALTER TABLE dndshare.session_presentation_state DROP CONSTRAINT IF EXISTS session_presentation_health_display_check;
ALTER TABLE dndshare.session_presentation_state ADD CONSTRAINT session_presentation_health_display_check
    CHECK (health_display IN ('numbers', 'words'));
UPDATE dndshare.session_presentation_state
SET display_scale = 100
WHERE display_scale NOT BETWEEN 75 AND 125;
ALTER TABLE dndshare.session_presentation_state DROP CONSTRAINT IF EXISTS session_presentation_display_scale_check;
ALTER TABLE dndshare.session_presentation_state ADD CONSTRAINT session_presentation_display_scale_check
    CHECK (display_scale BETWEEN 75 AND 125);
ALTER TABLE dndshare.session_presentation_state DROP COLUMN IF EXISTS show_initiative;

UPDATE dndshare.session_presentation_state
SET mode = 'idle', visible = true, material_id = NULL,
    effect = 'none', transition = 'fade', revision = revision + 1, changed_at = now()
WHERE mode = 'scene';
ALTER TABLE dndshare.session_presentation_state DROP CONSTRAINT IF EXISTS session_presentation_mode_check;
ALTER TABLE dndshare.session_presentation_state ADD CONSTRAINT session_presentation_mode_check
    CHECK (mode IN ('idle', 'material', 'combat'));
ALTER TABLE dndshare.session_presentation_state DROP COLUMN IF EXISTS scene_id;

INSERT INTO dndshare.session_presentation_state (session_id)
SELECT id FROM dndshare."session" WHERE deleted = false
ON CONFLICT (session_id) DO NOTHING;
