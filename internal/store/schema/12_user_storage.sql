-- ---------------------------------------------------------------------------
-- User-owned S3 object accounting. user_id already identifies the owner;
-- size/name/MIME complete the metadata needed for account storage reporting.
-- ---------------------------------------------------------------------------
ALTER TABLE dndshare.storage_image
    ADD COLUMN IF NOT EXISTS file_size int8 NULL,
    ADD COLUMN IF NOT EXISTS file_name varchar(255) NULL,
    ADD COLUMN IF NOT EXISTS mime_type varchar(128) NULL;

UPDATE dndshare.storage_image
SET file_size = octet_length(bytes)
WHERE file_size IS NULL AND bytes IS NOT NULL;

ALTER TABLE dndshare.storage_image DROP CONSTRAINT IF EXISTS storage_image_file_size_check;
ALTER TABLE dndshare.storage_image ADD CONSTRAINT storage_image_file_size_check CHECK (
    file_size IS NULL OR file_size >= 0
);

CREATE INDEX IF NOT EXISTS idx_storage_image_user_created
    ON dndshare.storage_image USING btree (user_id, created_at DESC)
    WHERE user_id IS NOT NULL AND deleted = false;

-- SVG icons live in PostgreSQL rather than S3, but user uploads follow the
-- same ownership/accounting contract. Seeded/system SVG rows remain unowned.
ALTER TABLE dndshare.svg_storage
    ADD COLUMN IF NOT EXISTS user_id int8 NULL REFERENCES dndshare.users(id),
    ADD COLUMN IF NOT EXISTS file_size int8 NULL,
    ADD COLUMN IF NOT EXISTS file_name varchar(255) NULL,
    ADD COLUMN IF NOT EXISTS mime_type varchar(128) NULL,
    ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now() NOT NULL;

UPDATE dndshare.svg_storage
SET file_size = octet_length(convert_to("data", 'UTF8'))
WHERE file_size IS NULL;

ALTER TABLE dndshare.svg_storage DROP CONSTRAINT IF EXISTS svg_storage_file_size_check;
ALTER TABLE dndshare.svg_storage ADD CONSTRAINT svg_storage_file_size_check CHECK (
    file_size IS NULL OR file_size >= 0
);

CREATE INDEX IF NOT EXISTS idx_svg_storage_user_created
    ON dndshare.svg_storage USING btree (user_id, created_at DESC)
    WHERE user_id IS NOT NULL;
