-- Canonical PHB abilities whose descriptions already define modifier-based
-- uses must expose the same rule as structured handbook data.
WITH resource_rules(name_ru, name_en, stat_id) AS (
    VALUES
        ('Вдохновение барда', 'Bardic Inspiration', 6),
        ('Гнев бури', 'Wrath of the Storm', 5)
)
UPDATE dndshare.item item
SET data = (COALESCE(item.data, '{}'::jsonb) - 'manual_size' - 'max_use')
    || jsonb_build_object(
        'max_use_stat', resource_rules.stat_id,
        'max_use_min', 1,
        'rollback_long_rest', true
    )
FROM resource_rules
WHERE item.type_id = 4
  AND item.user_id IS NULL
  AND (
      lower(item.name) = lower(resource_rules.name_ru)
      OR lower(COALESCE(item.name_en, '')) = lower(resource_rules.name_en)
  );

-- Bardic Inspiration used to be a manual one-charge resource. If a stored
-- entry was still full under that old rule, remove both copied counters so the
-- client initializes it as full under the live Charisma-modifier rule. Preserve
-- an actually spent counter (zero), while always removing the obsolete manual
-- maximum.
WITH bard AS (
    SELECT item.id
    FROM dndshare.item item
    WHERE item.type_id = 4
      AND item.user_id IS NULL
      AND (
          lower(item.name) = lower('Вдохновение барда')
          OR lower(COALESCE(item.name_en, '')) = lower('Bardic Inspiration')
      )
    ORDER BY item.id
    LIMIT 1
), rewritten AS (
    SELECT character.id,
           jsonb_agg(
               CASE
                   WHEN entry.value ->> 'id' = bard.id::text THEN
                       CASE
                           WHEN entry.value ? 'count'
                            AND entry.value ? 'max_use'
                            AND jsonb_typeof(entry.value -> 'count') = 'number'
                            AND jsonb_typeof(entry.value -> 'max_use') = 'number'
                            AND entry.value -> 'count' = entry.value -> 'max_use'
                               THEN entry.value - 'count' - 'max_use'
                           ELSE entry.value - 'max_use'
                       END
                   ELSE entry.value
               END
               ORDER BY entry.ordinal
           ) AS abilities
    FROM dndshare."char" character
    CROSS JOIN bard
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(character.data #> '{values,abilities_class}') = 'array'
                THEN character.data #> '{values,abilities_class}'
            ELSE '[]'::jsonb
        END
    )
        WITH ORDINALITY AS entry(value, ordinal)
    GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,abilities_class}', rewritten.abilities, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,abilities_class}' IS DISTINCT FROM rewritten.abilities;
