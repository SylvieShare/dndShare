-- Correct imported equipment identities after introducing measured item
-- instances. IDs below belong to the stable system catalogue; type/user/name
-- guards keep the correction away from user-created material.

-- The first measured-item migration accidentally sent an already-normalized
-- hemp rope through the silk branch on the next startup. Restore its identity
-- and per-foot economics explicitly.
UPDATE dndshare.item
SET name = 'Верёвка пеньковая',
    name_en = 'Rope, hempen',
    data = (data - 'cost' - 'weight') || jsonb_build_object(
        'measurement', 'length',
        'unit_cost_copper', 2,
        'unit_weight', 0.2
    )
WHERE id = 423
  AND user_id IS NULL
  AND type_id = 2;

-- Keep one canonical silk-rope row with the PHB price and weight per foot.
UPDATE dndshare.item
SET name = 'Верёвка шёлковая',
    name_en = 'Rope, silk',
    data = (data - 'cost' - 'weight') || jsonb_build_object(
        'measurement', 'length',
        'unit_cost_copper', 20,
        'unit_weight', 0.1
    )
WHERE id = 424
  AND user_id IS NULL
  AND type_id = 2;

-- Redirect every nested item reference before deleting the lean duplicate
-- silk-rope import. Both historical `id` links and canonical `item_id` links
-- occur in saved character and handbook JSON.
CREATE OR REPLACE FUNCTION dndshare.replace_catalog_item_reference(document jsonb, old_id int8, new_id int8)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    IF document IS NULL THEN
        RETURN NULL;
    END IF;
    CASE jsonb_typeof(document)
        WHEN 'object' THEN
            SELECT COALESCE(jsonb_object_agg(entry.key,
                CASE
                    WHEN entry.key IN ('id', 'item_id') AND entry.value = to_jsonb(old_id)
                        THEN to_jsonb(new_id)
                    ELSE dndshare.replace_catalog_item_reference(entry.value, old_id, new_id)
                END
            ), '{}'::jsonb)
            INTO result
            FROM jsonb_each(document) entry;
        WHEN 'array' THEN
            SELECT COALESCE(jsonb_agg(
                dndshare.replace_catalog_item_reference(entry.value, old_id, new_id)
                ORDER BY entry.ord
            ), '[]'::jsonb)
            INTO result
            FROM jsonb_array_elements(document) WITH ORDINALITY entry(value, ord);
        ELSE
            result := document;
    END CASE;
    RETURN result;
END;
$$;

WITH migrated AS (
    SELECT saved_character.id,
           dndshare.replace_catalog_item_reference(saved_character.data, 1428, 424) AS data
    FROM dndshare."char" saved_character
    WHERE saved_character.data::text LIKE '%1428%'
      AND EXISTS (
          SELECT 1 FROM dndshare.item duplicate
          WHERE duplicate.id = 1428 AND duplicate.user_id IS NULL AND duplicate.type_id = 2
            AND lower(COALESCE(duplicate.name_en, '')) = lower('Rope, silk')
      )
      AND EXISTS (
          SELECT 1 FROM dndshare.item canonical
          WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
            AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
      )
)
UPDATE dndshare."char" saved_character
SET data = migrated.data,
    version = saved_character.version + 1,
    changed_at = now()
FROM migrated
WHERE saved_character.id = migrated.id
  AND saved_character.data IS DISTINCT FROM migrated.data;

UPDATE dndshare.item item
SET data = dndshare.replace_catalog_item_reference(item.data, 1428, 424)
WHERE item.id <> 1428
  AND item.data::text LIKE '%1428%'
  AND EXISTS (
      SELECT 1 FROM dndshare.item duplicate
      WHERE duplicate.id = 1428 AND duplicate.user_id IS NULL AND duplicate.type_id = 2
        AND lower(COALESCE(duplicate.name_en, '')) = lower('Rope, silk')
  )
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  );

UPDATE dndshare.item
SET parent_id = 424
WHERE parent_id = 1428
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  );

UPDATE dndshare.session_npc
SET race_item_id = 424
WHERE race_item_id = 1428
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  );

INSERT INTO dndshare.item_content_source AS target (item_id, content_source_id, page, primary_source)
SELECT 424, duplicate_source.content_source_id, duplicate_source.page, duplicate_source.primary_source
FROM dndshare.item_content_source duplicate_source
WHERE duplicate_source.item_id = 1428
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  )
ON CONFLICT (item_id, content_source_id) DO UPDATE SET
    page = COALESCE(target.page, EXCLUDED.page),
    primary_source = target.primary_source OR EXCLUDED.primary_source;

UPDATE dndshare.item_version_compatibility
SET replaced_by_item_id = 424
WHERE replaced_by_item_id = 1428
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  );

INSERT INTO dndshare.item_version_compatibility (
    item_id, source_version_id, status, replaced_by_item_id, adapter_code
)
SELECT 424, source_version_id, status, replaced_by_item_id, adapter_code
FROM dndshare.item_version_compatibility
WHERE item_id = 1428
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  )
ON CONFLICT (item_id, source_version_id) DO NOTHING;

DELETE FROM dndshare.item duplicate
WHERE duplicate.id = 1428
  AND duplicate.user_id IS NULL
  AND duplicate.type_id = 2
  AND lower(COALESCE(duplicate.name_en, '')) = lower('Rope, silk')
  AND EXISTS (
      SELECT 1 FROM dndshare.item canonical
      WHERE canonical.id = 424 AND canonical.user_id IS NULL AND canonical.type_id = 2
        AND lower(COALESCE(canonical.name_en, '')) = lower('Rope, silk')
  );

DROP FUNCTION dndshare.replace_catalog_item_reference(jsonb, int8, int8);

-- This PHB equipment row was imported under a loose translation. Keep the
-- published Russian name and rules text used by the Player's Handbook.
UPDATE dndshare.item
SET name = 'Комплект для лазания',
    name_en = 'Climber''s Kit',
    data = data || jsonb_build_object(
        'desc', '<p>В комплект входят шлямбуры, накладные подошвы, перчатки и страховочная привязь. Действием можно закрепиться на высоте; после этого нельзя упасть более чем на 25 футов от точки крепления, но нельзя подняться выше чем на 25 футов от неё, не открепившись.</p>'
    )
WHERE id = 392
  AND user_id IS NULL
  AND type_id = 2
  AND lower(COALESCE(name_en, '')) = lower('Climber''s Kit');

-- Rope of Climbing and Rope of Entanglement are magic items from the Dungeon
-- Master's Guide, not ordinary PHB adventuring gear. Attach DMG first so a
-- database without that publication never loses its existing source link.
WITH dmg AS (
    SELECT content.id
    FROM dndshare.content_source content
    JOIN dndshare.source_version version ON version.id = content.native_source_version_id
    JOIN dndshare."source" source ON source.id = content.source_id
    WHERE upper(content.code) = 'DMG'
      AND version.version = '2014'
      AND lower(source.name) = 'dnd5e'
    ORDER BY content.id
    LIMIT 1
), magic_rope AS (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.user_id IS NULL
      AND item.type_id = 2
      AND (
          (item.id = 218 AND lower(COALESCE(item.name_en, '')) = lower('Rope of Climbing'))
          OR (item.id = 199 AND lower(COALESCE(item.name_en, '')) = lower('Rope of Entanglement'))
      )
)
INSERT INTO dndshare.item_content_source AS target (item_id, content_source_id, page, primary_source)
SELECT magic_rope.id, dmg.id, 197, true
FROM magic_rope CROSS JOIN dmg
ON CONFLICT (item_id, content_source_id) DO UPDATE SET
    page = COALESCE(target.page, EXCLUDED.page),
    primary_source = true;

DELETE FROM dndshare.item_content_source link
USING dndshare.item item, dndshare.content_source phb
WHERE link.item_id = item.id
  AND link.content_source_id = phb.id
  AND upper(phb.code) = 'PHB'
  AND item.user_id IS NULL
  AND item.type_id = 2
  AND (
      (item.id = 218 AND lower(COALESCE(item.name_en, '')) = lower('Rope of Climbing'))
      OR (item.id = 199 AND lower(COALESCE(item.name_en, '')) = lower('Rope of Entanglement'))
  )
  AND EXISTS (
      SELECT 1
      FROM dndshare.item_content_source dmg_link
      JOIN dndshare.content_source dmg ON dmg.id = dmg_link.content_source_id
      WHERE dmg_link.item_id = item.id AND upper(dmg.code) = 'DMG'
  );

UPDATE dndshare.item_type item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id = 2;
