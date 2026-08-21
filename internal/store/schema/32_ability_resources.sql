-- Ability, class-feature and feat usages can derive their live maximum from a
-- character ability modifier. Keep the handbook editor schema in the database
-- aligned with resources/items/item_{3,4,7}_shema.json.
WITH additions(field, ordinal) AS (
    VALUES
        ('{"name":"Характеристика количества использований","key":"max_use_stat","type":"suggest","suggest_id":16}'::jsonb, 1),
        ('{"name":"Минимум использований от модификатора","key":"max_use_min","type":"int","default":1}'::jsonb, 2)
), missing AS (
    SELECT item_type.id, jsonb_agg(additions.field ORDER BY additions.ordinal) AS fields
    FROM dndshare.item_type item_type
    CROSS JOIN additions
    WHERE item_type.id IN (3, 4, 7)
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
          WHERE current ->> 'key' = additions.field ->> 'key'
      )
    GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || missing.fields
FROM missing
WHERE item_type.id = missing.id;
