-- Read-only catalogue filter; membership is derived at query time, not stored in item data.
UPDATE dndshare.item_type
SET fields = jsonb_build_array(
  '{"key": "effect_source", "name": "Источник эффекта", "type": "select", "readonly": true, "filter": true, "options": [{"value": "basic", "label": "Базовые эффекты"}, {"value": "magic_item", "label": "Магические предметы"}, {"value": "spell", "label": "Заклинания"}]}'::jsonb
) || COALESCE(fields, '[]'::jsonb)
WHERE id = 15
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) field WHERE field->>'key' = 'effect_source');
