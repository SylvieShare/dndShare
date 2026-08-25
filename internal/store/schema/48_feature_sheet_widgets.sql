-- Ability-owned sheet widgets let features publish prominent metrics and active
-- modes without coupling the sheet to a class, item name or item id. Widgets
-- with the same key share one panel, so subclass features can append notes.
WITH addition(field) AS (
  VALUES ('{"name":"Виджеты листа","key":"sheet_widgets","type":"object_array","fields":[{"name":"Ключ общей панели","key":"key","type":"text"},{"name":"Название","key":"title","type":"text"},{"name":"Вид","key":"kind","type":"select","default":"metric","options":[{"value":"metric","label":"Показатель"},{"value":"toggle","label":"Переключатель"},{"value":"note","label":"Дополнение панели"}]},{"name":"Источник значения","key":"value_source","type":"select","options":[{"value":"weapon_damage","label":"Кости дополнительного урона"},{"value":"scaling","label":"Текущая строка прогрессии"}]},{"name":"Постоянное значение","key":"value","type":"text"},{"name":"Пояснение","key":"description","type":"text"},{"name":"Короткие тезисы","key":"details","type":"text_array"},{"name":"Цвет","key":"tone","type":"select","default":"accent","options":[{"value":"accent","label":"Акцент"},{"value":"danger","label":"Красный"},{"value":"warning","label":"Жёлтый"},{"value":"success","label":"Зелёный"},{"value":"info","label":"Синий"}]},{"name":"Ключ ресурса","key":"resource_key","type":"text"},{"name":"Ключ эффекта","key":"status_effect_key","type":"text"},{"name":"Подпись включения","key":"inactive_label","type":"text"},{"name":"Подпись активности","key":"active_label","type":"text"},{"name":"Порядок","key":"priority","type":"int"},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = CASE
  WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'sheet_widgets'
  ) THEN (
    SELECT jsonb_agg(CASE WHEN current.value ->> 'key' = 'sheet_widgets' THEN addition.field ELSE current.value END ORDER BY current.ordinality)
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY current(value, ordinality)
  )
  ELSE COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
END
FROM addition
WHERE item_type.id IN (3, 4, 7);

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{sheet_widgets}',
  '[{"key":"sneak_attack","title":"Скрытая атака","kind":"metric","value_source":"weapon_damage","description":"Дополнительный урон","details":["Фехтовальное или дальнобойное оружие","Преимущество или дееспособный враг цели в 5 футах","Без помехи","Раз за ход"],"tone":"accent","priority":10}]'::jsonb,
  true
)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Скрытая атака');

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{sheet_widgets}',
  '[{"key":"rage","title":"Ярость","kind":"toggle","value_source":"scaling","description":"Текущий бонус к урону","tone":"danger","status_effect_key":"rage","inactive_label":"Войти в ярость","active_label":"Выйти из ярости","priority":20}]'::jsonb,
  true
)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Ярость');
