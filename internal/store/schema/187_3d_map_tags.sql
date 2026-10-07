-- Explicit user request: the map workspace now supports only 3D tile documents.
UPDATE dndshare.session_map_display display
SET map_id = NULL, visible = false, revision = display.revision + 1
FROM dndshare.session_map map
WHERE display.map_id = map.id AND map.document->>'kind' IN ('image-grid', 'image');
DELETE FROM dndshare.session_map WHERE document->>'kind' IN ('image-grid', 'image');
DELETE FROM dndshare.battle_map WHERE document->>'kind' IN ('image-grid', 'image');
UPDATE dndshare.battle_map SET document = jsonb_set(
    (document - 'background' - 'credit') || jsonb_build_object('tags', CASE WHEN jsonb_typeof(document->'tags') = 'array' THEN document->'tags' ELSE '[]'::jsonb END),
    '{grid}', (document->'grid') - 'offsetX' - 'offsetY');
UPDATE dndshare.session_map SET document = jsonb_set(
    (document - 'background' - 'credit') || jsonb_build_object('tags', CASE WHEN jsonb_typeof(document->'tags') = 'array' THEN document->'tags' ELSE '[]'::jsonb END),
    '{grid}', (document->'grid') - 'offsetX' - 'offsetY');
ALTER TABLE dndshare.battle_map DROP COLUMN asset_id;
ALTER TABLE dndshare.session_map DROP COLUMN asset_id;
ALTER TABLE dndshare.battle_map ADD CONSTRAINT battle_map_tiles_only CHECK (document->>'kind' IS NOT NULL AND document->>'kind' = 'tiles');
ALTER TABLE dndshare.session_map ADD CONSTRAINT session_map_tiles_only CHECK (document->>'kind' IS NOT NULL AND document->>'kind' = 'tiles');
