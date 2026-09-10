-- World entities can use a symbolic icon until an image is chosen.
ALTER TABLE dndshare.session_location ALTER COLUMN image_id DROP NOT NULL;
ALTER TABLE dndshare.session_npc ALTER COLUMN image_id DROP NOT NULL;
