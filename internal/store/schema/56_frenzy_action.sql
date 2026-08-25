-- Feature actions may depend on active status codes and publish typed menu
-- consequences. Runtime consumers stay independent of feature names and ids.
WITH additions(fields) AS (
  VALUES ('[{"name":"Требуемые активные эффекты","key":"required_status_codes","type":"text_array"},{"name":"Пункты меню","key":"menu_effects","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Название","key":"title","type":"text"},{"name":"Действие","key":"kind","type":"select","options":[{"value":"adjust_counter","label":"Изменить счётчик"}]},{"name":"Поле персонажа","key":"value_id","type":"text"},{"name":"Ключ счётчика","key":"counter_key","type":"text"},{"name":"Изменение","key":"delta","type":"int"},{"name":"Минимум","key":"min","type":"int"},{"name":"Максимум","key":"max","type":"int"},{"name":"Тон","key":"tone","type":"select","options":[{"value":"danger","label":"Опасность"},{"value":"warning","label":"Предупреждение"},{"value":"info","label":"Информация"},{"value":"success","label":"Успех"},{"value":"accent","label":"Акцент"}]}]}]'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN row_field.field ->> 'key' = 'feature_actions' THEN jsonb_set(
      row_field.field,
      '{fields}',
      COALESCE(row_field.field -> 'fields', '[]'::jsonb) || COALESCE((
        SELECT jsonb_agg(candidate.field ORDER BY candidate.ord)
        FROM jsonb_array_elements(additions.fields) WITH ORDINALITY AS candidate(field, ord)
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(row_field.field -> 'fields', '[]'::jsonb)) nested
          WHERE nested ->> 'key' = candidate.field ->> 'key'
        )
      ), '[]'::jsonb),
      true
    ) ELSE row_field.field END
    ORDER BY row_field.ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
  CROSS JOIN additions
)
WHERE item_type.id IN (3, 4, 7)
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(item_type.fields) field
    WHERE field ->> 'key' = 'feature_actions'
  );

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{feature_actions}',
  '[{"key":"frenzy_attack","title":"Неистовство","action_type":"bonus_action","description":"Пока длится неистовая ярость, вы можете совершить одну рукопашную атаку оружием бонусным действием.","requirements":["Со следующего хода после входа в неистовство","Когда неистовая ярость закончится, получите 1 уровень истощения"],"required_status_codes":["rage"],"menu_effects":[{"key":"gain_exhaustion","title":"Получить 1 уровень истощения","kind":"adjust_counter","value_id":"exhaustion","counter_key":"level","delta":1,"min":0,"max":6,"tone":"danger"}],"level":3,"priority":20}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Frenzy');
