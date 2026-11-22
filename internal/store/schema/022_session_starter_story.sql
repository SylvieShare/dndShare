ALTER TABLE dndshare.session_chapter ALTER COLUMN image_id DROP NOT NULL;
ALTER TABLE dndshare.session_scene DROP CONSTRAINT session_scene_visual_source_check;
