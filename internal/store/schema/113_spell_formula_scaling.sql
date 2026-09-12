-- Schema only. Catalogue corrections are applied through the handbook MCP.

UPDATE dndshare.item_type SET fields = (
  SELECT jsonb_agg(CASE WHEN field->>'key' = 'damage' THEN jsonb_set(field, '{fields}',
    field->'fields' || (SELECT COALESCE(jsonb_agg(addition), '[]'::jsonb)
      FROM jsonb_array_elements($fields$[{"name":"Плюс модификатор заклинательной характеристики","key":"add_mod","type":"bool"},{"name":"Кругов между усилениями","key":"scaling_step","type":"int","default":1},{"name":"Максимум усилений","key":"scaling_max_steps","type":"int","hint":"Пусто — без ограничения."},{"key":"scaling_levels","name":"Явные круги усиления (вместо шага)","type":"object_array","fields":[{"key":"level","name":"Круг ячейки","type":"int"}]}]$fields$::jsonb) addition
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(field->'fields') old WHERE old->>'key' = addition->>'key')))
    ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(fields) WITH ORDINALITY AS rows(field, ord)
) WHERE id = 5;

UPDATE dndshare.item_type SET fields = (
  SELECT jsonb_agg(CASE WHEN field->>'key' = 'heal' THEN jsonb_set(field, '{fields}',
    field->'fields' || (SELECT COALESCE(jsonb_agg(addition), '[]'::jsonb)
      FROM jsonb_array_elements($fields$[{"name":"Кругов между усилениями","key":"scaling_step","type":"int","default":1},{"name":"Максимум усилений","key":"scaling_max_steps","type":"int","hint":"Пусто — без ограничения."},{"key":"scaling_levels","name":"Явные круги усиления (вместо шага)","type":"object_array","fields":[{"key":"level","name":"Круг ячейки","type":"int"}]}]$fields$::jsonb) addition
      WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(field->'fields') old WHERE old->>'key' = addition->>'key')))
    ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(fields) WITH ORDINALITY AS rows(field, ord)
) WHERE id = 5;

UPDATE dndshare.item_type SET fields = (
  SELECT jsonb_agg(CASE WHEN field->>'key' = 'heal' THEN jsonb_set(field, '{fields}', (
    SELECT jsonb_agg(CASE WHEN child->>'key' IN ('dices','addon') AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(child->'fields') old WHERE old->>'key' = 'bonus'
    ) THEN jsonb_set(child, '{fields}', child->'fields' || '[{"key":"bonus","name":"Постоянное лечение","type":"int"}]'::jsonb)
      ELSE child END ORDER BY child_ord)
    FROM jsonb_array_elements(field->'fields') WITH ORDINALITY AS children(child, child_ord)
  )) ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(fields) WITH ORDINALITY AS rows(field, ord)
) WHERE id = 5;

UPDATE dndshare.item_type SET fields = fields || jsonb_build_array($field${"key":"rolls","name":"Отдельные броски эффектов","type":"object_array","fields":[{"key":"label","name":"Название броска и условие","type":"text"},{"key":"kind","name":"Результат","type":"text","default":"effect","filter_values":["damage","heal","effect"],"filter_labels":{"damage":"Урон","heal":"Лечение","effect":"Другой результат"}},{"name":"Плюс модификатор заклинательной характеристики","key":"add_mod","type":"bool"},{"name":"Дальнобойная атака","key":"range_attack","type":"boolean"},{"name":"Тип роста","key":"scaling","type":"text","default":"none","filter_values":["none","slot","cantrip"],"filter_labels":{"none":"нет","slot":"за круг ячейки","cantrip":"за уровень героя"}},{"name":"Кругов между усилениями","key":"scaling_step","type":"int","default":1},{"name":"Максимум усилений","key":"scaling_max_steps","type":"int","hint":"Пусто — без ограничения."},{"name":"Кубики (база)","key":"dices","type":"object_array","fields":[{"name":"Количество кубиков","key":"count","type":"int","default":1},{"name":"Кубик","key":"dice_id","type":"dice"},{"name":"Вид урона","key":"type","type":"suggest","suggest_id":12},{"name":"Бонус","key":"bonus","type":"int"}]},{"name":"Кубики (аддон за уровень)","key":"addon","type":"object_array","fields":[{"name":"Количество кубиков","key":"count","type":"int","default":1},{"name":"Кубик","key":"dice_id","type":"dice"},{"name":"Вид урона","key":"type","type":"suggest","suggest_id":12},{"name":"Бонус","key":"bonus","type":"int"}]},{"key":"scaling_levels","name":"Явные круги усиления (вместо шага)","type":"object_array","fields":[{"key":"level","name":"Круг ячейки","type":"int"}]}]}$field$::jsonb)
WHERE id = 5 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key' = 'rolls');
