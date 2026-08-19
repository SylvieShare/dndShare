-- Armor catalogue presentation and the structured proficiency requirement used
-- by the handbook today and by the character-creation shop in the future.

WITH field AS (
    SELECT '{"key":"required_armor_proficiency","name":"Требуемое владение доспехами","type":"suggest","suggest_type_id":3,"filter":true}'::jsonb AS value
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(field.value)
FROM field
WHERE item_type.id = 12
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'required_armor_proficiency'
  );

WITH category_proficiency(category, proficiency) AS (
    VALUES
        ('light', 'Лёгкие доспехи'),
        ('medium', 'Средние доспехи'),
        ('heavy', 'Тяжёлые доспехи'),
        ('shield', 'Щиты')
), resolved AS (
    SELECT mapping.category, suggest.id
    FROM category_proficiency mapping
    JOIN dndshare.suggest suggest
      ON suggest.type_id = 3
     AND suggest.user_id IS NULL
     AND lower(suggest.value) = lower(mapping.proficiency)
)
UPDATE dndshare.item item
SET data = jsonb_set(item.data, '{required_armor_proficiency}', to_jsonb(resolved.id), true)
FROM resolved
WHERE item.type_id = 12
  AND item.user_id IS NULL
  AND item.data ->> 'category' = resolved.category;
