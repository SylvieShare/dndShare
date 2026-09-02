-- Some feature actions must be activated against a concrete sheet entity.
-- The action row opens a domain-neutral target picker so a resource cannot be
-- spent without choosing a target.
WITH additions(field) AS (
  SELECT value
  FROM jsonb_array_elements('[
    {"name":"Вид цели","key":"target_kind","type":"select","options":[{"value":"weapon","label":"Оружие"}]},
    {"name":"Код накладываемого эффекта","key":"status_effect_code","type":"text"},
    {"name":"Параметр цели эффекта","key":"target_parameter","type":"text"}
  ]'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN outer_field.value ->> 'key' = 'feature_actions' THEN jsonb_set(
      outer_field.value,
      '{fields}',
      COALESCE(outer_field.value -> 'fields', '[]'::jsonb) || COALESCE((
        SELECT jsonb_agg(addition.field)
        FROM additions addition
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(outer_field.value -> 'fields', '[]'::jsonb)) nested
          WHERE nested ->> 'key' = addition.field ->> 'key'
        )
      ), '[]'::jsonb),
      true
    ) ELSE outer_field.value END
    ORDER BY outer_field.ordinality
  )
  FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY outer_field(value, ordinality)
)
WHERE item_type.id IN (3, 4, 7)
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) field
    WHERE field ->> 'key' = 'feature_actions'
  );

-- Targeted status rules resolve their target from the runtime instance. A
-- minimum applies after the optional ability modifier is calculated.
WITH additions(field) AS (
  SELECT value
  FROM jsonb_array_elements('[
    {"name":"Характеристика-модификатор","key":"ability_modifier","type":"suggest","suggest_id":16},
    {"name":"Минимальный бонус","key":"minimum","type":"int"},
    {"name":"Параметр цели","key":"target_parameter","type":"text"}
  ]'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN outer_field.value ->> 'key' = 'derived_effects' THEN jsonb_set(
      outer_field.value,
      '{fields}',
      COALESCE(outer_field.value -> 'fields', '[]'::jsonb) || COALESCE((
        SELECT jsonb_agg(addition.field)
        FROM additions addition
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(outer_field.value -> 'fields', '[]'::jsonb)) nested
          WHERE nested ->> 'key' = addition.field ->> 'key'
        )
      ), '[]'::jsonb),
      true
    ) ELSE outer_field.value END
    ORDER BY outer_field.ordinality
  )
  FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY outer_field(value, ordinality)
)
WHERE item_type.id = 15
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) field
    WHERE field ->> 'key' = 'derived_effects'
  );

INSERT INTO dndshare.item (name, name_en, data, type_id)
SELECT
  'Священное оружие',
  'Sacred Weapon',
  '{"code":"sacred_weapon","desc":"Выбранное оружие на 1 минуту получает бонус Харизмы (минимум +1) к броскам атаки. Немагическое оружие считается магическим и испускает яркий свет в радиусе 20 футов и тусклый ещё на 20 футов.","polarity":"positive","color":"#fbbf24","stacking":"multiple","duration":{"kind":"minutes","value":1},"derived_effects":[{"kind":"weapon_attack_bonus","ability_modifier":6,"minimum":1,"target_parameter":"weapon_uid","label":"Священное оружие"}]}'::jsonb,
  15
WHERE NOT EXISTS (
  SELECT 1
  FROM dndshare.item
  WHERE type_id = 15
    AND user_id IS NULL
    AND data ->> 'code' = 'sacred_weapon'
);

UPDATE dndshare.item sacred_weapon
SET data = jsonb_set(
  COALESCE(sacred_weapon.data, '{}'::jsonb),
  '{feature_actions}',
  COALESCE((
    SELECT jsonb_agg(
      action.value || '{"target_kind":"weapon","status_effect_code":"sacred_weapon","target_parameter":"weapon_uid","requirements":["При активации выберите оружие"]}'::jsonb
      ORDER BY action.ordinality
    )
    FROM jsonb_array_elements(COALESCE(sacred_weapon.data -> 'feature_actions', '[]'::jsonb)) WITH ORDINALITY action(value, ordinality)
  ), '[]'::jsonb),
  true
)
WHERE sacred_weapon.type_id = 4
  AND sacred_weapon.user_id IS NULL
  AND (
    lower(COALESCE(sacred_weapon.name_en, '')) = lower('Sacred Weapon')
    OR lower(sacred_weapon.name) = lower('Священное оружие')
  )
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(sacred_weapon.data -> 'class_ids', '[]'::jsonb)) class_ref
    WHERE (class_ref ->> 'id')::bigint = 4021
  );

-- Existing weapons need stable identities because a temporary render key is
-- not sufficient for a persisted targeted effect.
WITH rewritten AS (
  SELECT character.id,
         jsonb_agg(
           CASE
             WHEN jsonb_typeof(weapon.value) = 'object' AND COALESCE(weapon.value ->> 'uid', '') = ''
               THEN weapon.value || jsonb_build_object('uid', 'weapon-' || character.id::text || '-' || weapon.ordinality::text)
             ELSE weapon.value
           END
           ORDER BY weapon.ordinality
         ) AS weapons
  FROM dndshare."char" character
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,weapon}') = 'array' THEN character.data #> '{values,weapon}'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY weapon(value, ordinality)
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,weapon}', rewritten.weapons, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,weapon}' IS DISTINCT FROM rewritten.weapons;

UPDATE dndshare.item_type item_type
SET count_items = (SELECT COUNT(*) FROM dndshare.item item WHERE item.type_id = item_type.id AND item.user_id IS NULL)
WHERE item_type.id = 15;
