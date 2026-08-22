-- Innate spells sometimes use a rules-defined level that differs from the
-- spell's base level (Hellish Rebuke from Infernal Legacy is cast at 2nd).
UPDATE dndshare.item_type item_type
SET fields = rewritten.fields
FROM (
    SELECT source.id,
           jsonb_agg(
               CASE
                   WHEN field.value ->> 'key' = 'granted_spells'
                       AND NOT EXISTS (
                           SELECT 1
                           FROM jsonb_array_elements(COALESCE(field.value -> 'fields', '[]'::jsonb)) nested
                           WHERE nested ->> 'key' = 'cast_level'
                       )
                   THEN jsonb_set(
                       field.value,
                       '{fields}',
                       COALESCE(field.value -> 'fields', '[]'::jsonb)
                           || '[{"name":"Уровень сотворения","key":"cast_level","type":"int"}]'::jsonb,
                       true
                   )
                   ELSE field.value
               END
               ORDER BY field.ordinality
           ) AS fields
    FROM dndshare.item_type source
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.fields, '[]'::jsonb))
        WITH ORDINALITY AS field(value, ordinality)
    WHERE source.id IN (3, 4, 7)
    GROUP BY source.id
) rewritten
WHERE item_type.id = rewritten.id;

UPDATE dndshare.item
SET data = jsonb_set(
    COALESCE(data, '{}'::jsonb),
    '{granted_spells}',
    (
        SELECT jsonb_agg(
            CASE WHEN grant_row -> 'spell' ->> 'id' = '542'
                 THEN grant_row || '{"cast_level":2}'::jsonb
                 ELSE grant_row
            END
        )
        FROM jsonb_array_elements(COALESCE(data -> 'granted_spells', '[]'::jsonb)) grant_row
    ),
    true
)
WHERE id = 1443
  AND type_id = 3
  AND user_id IS NULL
  AND jsonb_array_length(COALESCE(data -> 'granted_spells', '[]'::jsonb)) > 0;
