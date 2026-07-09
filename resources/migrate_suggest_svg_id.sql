-- Rename svg_upload_id -> svg_id
ALTER TABLE dndshare.suggest RENAME COLUMN svg_upload_id TO svg_id;

-- Add code column (English name / system key)
ALTER TABLE dndshare.suggest ADD COLUMN IF NOT EXISTS code VARCHAR(255);
