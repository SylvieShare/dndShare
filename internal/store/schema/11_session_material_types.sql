-- ---------------------------------------------------------------------------
-- Typed presentation materials. storage_image remains the shared S3 object
-- registry despite its historical name; asset_id may reference images or video.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare' AND table_name = 'session_material' AND column_name = 'image_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'dndshare' AND table_name = 'session_material' AND column_name = 'asset_id'
    ) THEN
        ALTER TABLE dndshare.session_material RENAME COLUMN image_id TO asset_id;
    END IF;
END $$;

ALTER TABLE dndshare.session_material
    ALTER COLUMN asset_id DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS content text NULL,
    ADD COLUMN IF NOT EXISTS note_style varchar(24) NULL,
    ADD COLUMN IF NOT EXISTS map_data jsonb NULL;

ALTER TABLE dndshare.session_material DROP CONSTRAINT IF EXISTS session_material_kind_check;
ALTER TABLE dndshare.session_material ADD CONSTRAINT session_material_kind_check CHECK (
    kind IN ('image', 'video', 'text', 'note', 'map')
);

ALTER TABLE dndshare.session_material DROP CONSTRAINT IF EXISTS session_material_payload_check;
ALTER TABLE dndshare.session_material ADD CONSTRAINT session_material_payload_check CHECK (
    (kind IN ('image', 'video', 'map') AND asset_id IS NOT NULL AND content IS NULL AND note_style IS NULL)
    OR (kind = 'text' AND asset_id IS NULL AND content IS NOT NULL AND note_style IS NULL)
    OR (kind = 'note' AND asset_id IS NULL AND content IS NOT NULL
        AND note_style IN ('parchment', 'letter', 'dossier', 'arcane'))
);

UPDATE dndshare.session_material
SET map_data = '{}'::jsonb
WHERE kind = 'map' AND map_data IS NULL;
