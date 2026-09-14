ALTER TABLE dndshare.item ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

-- Incomplete classes remain available by ID for existing characters and editors.
UPDATE dndshare.item
SET hidden = true
WHERE type_id = 9 AND user_id IS NULL
  AND (lower(name_en) IN ('magus', 'shaman') OR lower(name) IN ('магус', 'шаман'));
