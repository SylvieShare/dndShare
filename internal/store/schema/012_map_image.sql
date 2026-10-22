ALTER TABLE dndshare.session_map ADD COLUMN image_id bigint REFERENCES dndshare.storage_image(id);
ALTER TABLE dndshare.session_map DROP CONSTRAINT session_map_tiles_only;
ALTER TABLE dndshare.session_map ADD CONSTRAINT session_map_kind_check CHECK (
    (document->>'kind'='tiles' AND image_id IS NULL)
    OR (document->>'kind'='image' AND image_id IS NOT NULL AND document->'image'->>'id'=image_id::text)
);
CREATE INDEX session_map_image_idx ON dndshare.session_map(image_id) WHERE image_id IS NOT NULL;
