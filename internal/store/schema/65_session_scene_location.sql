ALTER TABLE dndshare.session_scene
    ADD COLUMN IF NOT EXISTS location_id int8 NULL;

ALTER TABLE dndshare.session_scene
    ALTER COLUMN image_id DROP NOT NULL;

ALTER TABLE dndshare.session_scene
    DROP CONSTRAINT IF EXISTS session_scene_visual_source_check;
ALTER TABLE dndshare.session_scene
    ADD CONSTRAINT session_scene_visual_source_check CHECK (
        image_id IS NOT NULL OR location_id IS NOT NULL
    );

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'session_scene_location_fk'
    ) THEN
        ALTER TABLE dndshare.session_scene
            ADD CONSTRAINT session_scene_location_fk
            FOREIGN KEY (location_id)
            REFERENCES dndshare.session_location(id)
            ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_scene_location_id
    ON dndshare.session_scene USING btree (location_id)
    WHERE location_id IS NOT NULL;
