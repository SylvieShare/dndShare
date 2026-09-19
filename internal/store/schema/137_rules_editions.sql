-- Explicit item/edition decisions. Publication membership is provenance, never
-- a fallback permission. Existing characters continue to refer to exact IDs.
INSERT INTO dndshare.source_version (source_id, version)
SELECT id, '2024' FROM dndshare.source WHERE lower(name)='dnd5e'
ON CONFLICT DO NOTHING;

ALTER TABLE dndshare.item_version_compatibility
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_item_edition_selection
  ON dndshare.item_version_compatibility (source_version_id, status, item_id);
CREATE INDEX IF NOT EXISTS idx_item_edition_replacement
  ON dndshare.item_version_compatibility (replaced_by_item_id);

-- Preserve the existing catalogue's edition, including effects and personal
-- materials that used to bypass publication filtering.
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status)
SELECT i.id, sv.id, 'native'
FROM dndshare.item i
JOIN dndshare.item_type t ON t.id=i.type_id
JOIN dndshare.source_version sv ON sv.source_id=t.source_id
JOIN dndshare.source src ON src.id=sv.source_id
WHERE (lower(src.name)='dnd5e' AND sv.version='2014')
   OR lower(src.name)<>'dnd5e'
ON CONFLICT DO NOTHING;

INSERT INTO dndshare.content_source(source_id,native_source_version_id,name,code,kind,is_default,sort_order)
SELECT sv.source_id,sv.id,'Книга игрока 2024','PHB','core',true,0
FROM dndshare.source_version sv JOIN dndshare.source s ON s.id=sv.source_id
WHERE lower(s.name)='dnd5e' AND sv.version='2024'
ON CONFLICT DO NOTHING;

-- Source statuses describe provenance; actual counts and availability are
-- derived from explicit item decisions by the runtime.
INSERT INTO dndshare.content_source_compatibility(content_source_id,source_version_id,status)
SELECT id,native_source_version_id,'native' FROM dndshare.content_source
WHERE native_source_version_id IS NOT NULL ON CONFLICT DO NOTHING;

-- Persist origin when an editor creates an adapted or revised variant.
ALTER TABLE dndshare.item ADD COLUMN IF NOT EXISTS derived_from_item_id bigint
  REFERENCES dndshare.item(id) ON DELETE SET NULL;
ALTER TABLE dndshare.item ADD COLUMN IF NOT EXISTS derivation_kind text
  CHECK (derivation_kind IN ('revision','adaptation'));
CREATE INDEX IF NOT EXISTS idx_item_derived_from ON dndshare.item(derived_from_item_id);

CREATE UNIQUE INDEX idx_item_edition_import_key ON dndshare.item((data->>'edition_key')) WHERE user_id IS NULL AND data->>'edition_key' IS NOT NULL;
