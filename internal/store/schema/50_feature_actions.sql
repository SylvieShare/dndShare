-- Abilities, racial traits and feats may publish sheet actions. The sheet
-- groups them by action economy and keeps their source and conditions readonly;
-- runtime code does not inspect feature names or ids.
WITH addition(field) AS (
  VALUES ('{"name":"Действия на листе","key":"feature_actions","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Название","key":"title","type":"text"},{"name":"Вид действия","key":"action_type","type":"select","default":"action","options":[{"value":"action","label":"Действие"},{"value":"bonus_action","label":"Бонусное действие"},{"value":"reaction","label":"Реакция"},{"value":"free","label":"Свободное действие"},{"value":"special","label":"Особое действие"}]},{"name":"Описание","key":"description","type":"description"},{"name":"Стандартные действия","key":"suggest_action_codes","type":"text_array"},{"name":"Условия","key":"requirements","type":"text_array"},{"name":"Расходует ресурс способности","key":"uses_resource","type":"bool"},{"name":"Ключ отдельного ресурса","key":"resource_key","type":"text"},{"name":"Расход ресурса","key":"resource_cost","type":"int","default":1},{"name":"Порядок","key":"priority","type":"int"},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'feature_actions'
  );

-- Existing databases already have the outer feature_actions field. Extend its
-- nested editor contract independently so startup remains idempotent.
WITH addition(field) AS (
  VALUES ('{"name":"Стандартные действия","key":"suggest_action_codes","type":"text_array"}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN row_field.field ->> 'key' = 'feature_actions' THEN jsonb_set(
      row_field.field,
      '{fields}',
      COALESCE(row_field.field -> 'fields', '[]'::jsonb) || jsonb_build_array(addition.field),
      true
    ) ELSE row_field.field END
    ORDER BY ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
  CROSS JOIN addition
)
WHERE item_type.id IN (3, 4, 7)
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(item_type.fields) field
    WHERE field ->> 'key' = 'feature_actions'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) nested
    WHERE field ->> 'key' = 'feature_actions'
      AND nested ->> 'key' = 'suggest_action_codes'
  );

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{feature_actions}',
  '[{"key":"cunning_action","title":"Хитрое действие","action_type":"bonus_action","description":"Совершите одно из стандартных действий бонусным действием.","suggest_action_codes":["dash","disengage","hide"],"requirements":["Только в свой ход"],"level":2,"priority":10}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Cunning Action');

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{feature_actions}',
  '[{"key":"uncanny_dodge","title":"Увёртливость","action_type":"reaction","description":"Уменьшить вдвое урон от попавшей по вам атаки.","requirements":["Атакующее существо должно быть вам видно"],"level":5,"priority":10}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Uncanny Dodge');

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{feature_actions}',
  '[{"key":"fast_hands","title":"Быстрые руки","action_type":"bonus_action","description":"Совершить проверку Ловкости рук, применить воровские инструменты или использовать предмет.","requirements":["Использует бонусное действие Хитрого действия"],"level":3,"priority":40}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Fast Hands');

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{feature_actions}',
  '[{"key":"mage_hand_control","title":"Управлять Магической рукой","action_type":"bonus_action","description":"Управлять невидимой Магической рукой и выполнять ею тонкие манипуляции.","requirements":["Использует бонусное действие Хитрого действия"],"level":3,"priority":40}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Mage Hand Legerdemain');

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{feature_actions}',
  '[{"key":"versatile_trickster","title":"Разносторонний ловкач","action_type":"bonus_action","description":"Отвлечь существо Магической рукой и получить преимущество на атаки по нему до конца хода.","requirements":["Цель находится в пределах 5 футов от Магической руки"],"level":13,"priority":50}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Versatile Trickster');
