-- The owner's old "Ликвидация" card predates the canonical PHB Assassin
-- feature. Keep the published Russian title on the system item and redirect
-- saved sheets before removing the personal duplicate. Resolving the target by
-- its stable English identity avoids coupling runtime behaviour to a title.
UPDATE dndshare.item
SET name = 'Ликвидация'
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Assassinate');

WITH target AS (
  SELECT duplicate.id AS old_id, canonical.id AS new_id
  FROM dndshare.item duplicate
  CROSS JOIN LATERAL (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.type_id = 4
      AND item.user_id IS NULL
      AND lower(COALESCE(item.name_en, '')) = lower('Assassinate')
    ORDER BY item.id
    LIMIT 1
  ) canonical
  WHERE duplicate.id = 4012
    AND duplicate.type_id = 4
    AND duplicate.user_id IS NOT NULL
    AND lower(duplicate.name) = lower('Ликвидация')
), rewritten AS (
  SELECT character.id,
         jsonb_agg(
           CASE
             WHEN entry.value ->> 'id' = target.old_id::text
               THEN jsonb_set(entry.value, '{id}', to_jsonb(target.new_id), false)
             ELSE entry.value
           END
           ORDER BY entry.ordinal
         ) AS abilities
  FROM dndshare."char" character
  JOIN target ON true
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(character.data #> '{values,abilities_class}') = 'array'
        THEN character.data #> '{values,abilities_class}'
      ELSE '[]'::jsonb
    END
  ) WITH ORDINALITY AS entry(value, ordinal)
  GROUP BY character.id
  HAVING bool_or(entry.value ->> 'id' = target.old_id::text)
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,abilities_class}', rewritten.abilities, true),
    version = character.version + 1,
    changed_at = now()
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,abilities_class}' IS DISTINCT FROM rewritten.abilities;

WITH target AS (
  SELECT duplicate.id AS old_id, canonical.id AS new_id
  FROM dndshare.item duplicate
  CROSS JOIN LATERAL (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.type_id = 4
      AND item.user_id IS NULL
      AND lower(COALESCE(item.name_en, '')) = lower('Assassinate')
    ORDER BY item.id
    LIMIT 1
  ) canonical
  WHERE duplicate.id = 4012
    AND duplicate.type_id = 4
    AND duplicate.user_id IS NOT NULL
    AND lower(duplicate.name) = lower('Ликвидация')
)
UPDATE dndshare.item item
SET parent_id = target.new_id
FROM target
WHERE item.parent_id = target.old_id;

WITH target AS (
  SELECT duplicate.id AS old_id, canonical.id AS new_id
  FROM dndshare.item duplicate
  CROSS JOIN LATERAL (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.type_id = 4
      AND item.user_id IS NULL
      AND lower(COALESCE(item.name_en, '')) = lower('Assassinate')
    ORDER BY item.id
    LIMIT 1
  ) canonical
  WHERE duplicate.id = 4012
    AND duplicate.type_id = 4
    AND duplicate.user_id IS NOT NULL
    AND lower(duplicate.name) = lower('Ликвидация')
)
UPDATE dndshare.item_version_compatibility compatibility
SET replaced_by_item_id = target.new_id
FROM target
WHERE compatibility.replaced_by_item_id = target.old_id;

DELETE FROM dndshare.item duplicate
WHERE duplicate.id = 4012
  AND duplicate.type_id = 4
  AND duplicate.user_id IS NOT NULL
  AND lower(duplicate.name) = lower('Ликвидация')
  AND EXISTS (
    SELECT 1
    FROM dndshare.item canonical
    WHERE canonical.type_id = 4
      AND canonical.user_id IS NULL
      AND lower(COALESCE(canonical.name_en, '')) = lower('Assassinate')
  );
