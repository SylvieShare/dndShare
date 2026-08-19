-- Every handbook weapon declares the proficiency options that can satisfy its
-- requirement. Multiple ids use OR semantics: broad simple/martial training or
-- a narrower proficiency granted by a class or race are interchangeable.

WITH field AS (
    SELECT '{"key":"required_weapon_proficiencies","name":"Подходящие владения оружием","type":"suggest_array","suggest_id":4,"match":"any","filter":true}'::jsonb AS value
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(field.value)
FROM field
WHERE item_type.id = 1
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'required_weapon_proficiencies'
  );

WITH requirement AS (
    SELECT
        item.id,
        CASE
            WHEN lower(item.name) = 'безоружный удар' THEN NULL
            WHEN COALESCE((item.data ->> 'is_military')::boolean, false) THEN 'Воинское оружие'
            ELSE 'Простое оружие'
        END AS broad_value,
        CASE lower(item.name)
            WHEN 'боевой молот' THEN 'Боевые молоты'
            WHEN 'боевой посох' THEN 'Боевые посохи'
            WHEN 'боевой топор' THEN 'Боевые топоры'
            WHEN 'длинный меч' THEN 'Длинные мечи'
            WHEN 'дротик' THEN 'Дротики'
            WHEN 'кинжал' THEN 'Кинжалы'
            WHEN 'короткий меч' THEN 'Короткие мечи'
            WHEN 'лёгкий арбалет' THEN 'Легкие арбалеты'
            WHEN 'лёгкий молот' THEN 'Легкие молоты'
            WHEN 'праща' THEN 'Пращи'
            WHEN 'ручной арбалет' THEN 'Ручные арбалеты'
            WHEN 'ручной топор' THEN 'Ручные топоры'
            ELSE NULL
        END AS specific_value
    FROM dndshare.item item
    WHERE item.type_id = 1 AND item.user_id IS NULL
), resolved AS (
    SELECT
        requirement.id,
        array_remove(ARRAY[broad.id, specific.id], NULL::bigint) AS proficiency_ids
    FROM requirement
    LEFT JOIN dndshare.suggest broad
      ON broad.type_id = 4
     AND broad.user_id IS NULL
     AND lower(broad.value) = lower(requirement.broad_value)
    LEFT JOIN dndshare.suggest specific
      ON specific.type_id = 4
     AND specific.user_id IS NULL
     AND lower(specific.value) = lower(requirement.specific_value)
)
UPDATE dndshare.item item
SET data = jsonb_set(item.data, '{required_weapon_proficiencies}', to_jsonb(resolved.proficiency_ids), true)
FROM resolved
WHERE item.id = resolved.id;
