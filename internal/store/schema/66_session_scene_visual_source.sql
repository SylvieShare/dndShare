ALTER TABLE dndshare.session_scene
    DROP CONSTRAINT IF EXISTS session_scene_visual_source_check;

ALTER TABLE dndshare.session_scene
    ADD CONSTRAINT session_scene_visual_source_check CHECK (
        image_id IS NOT NULL OR location_id IS NOT NULL
    );
