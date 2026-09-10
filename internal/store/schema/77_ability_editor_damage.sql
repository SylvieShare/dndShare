-- Damage options are composable switches; menu captions no longer belong to rules.
UPDATE dndshare.item_type AS item_type
SET fields = (
  SELECT jsonb_agg(CASE WHEN field->>'key' = 'weapon_damage' THEN
    jsonb_set(field, '{fields}', (SELECT COALESCE(jsonb_agg(child ORDER BY child_ord), '[]'::jsonb)
      FROM jsonb_array_elements(field->'fields') WITH ORDINALITY AS children(child, child_ord)
      WHERE child->>'key' NOT IN ('menu_label', 'critical_menu_label')))
    ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS fields(field, ord)
)
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(item_type.fields) field WHERE field->>'key' = 'weapon_damage');

UPDATE dndshare.item AS item
SET data = jsonb_set(data, '{weapon_damage}', (
  SELECT jsonb_agg(rule - 'menu_label' - 'critical_menu_label' ORDER BY ord)
  FROM jsonb_array_elements(item.data->'weapon_damage') WITH ORDINALITY AS rules(rule, ord)
))
WHERE jsonb_array_length(CASE WHEN jsonb_typeof(data->'weapon_damage') = 'array' THEN data->'weapon_damage' ELSE '[]'::jsonb END) > 0;

-- The standard Sneak Attack has one source of truth: ceil(class level / 2)d6.
-- Remove only matching display copies; preserve any deliberately different table.
UPDATE dndshare.item
SET data = data - 'scaling' - 'display_scaling'
WHERE type_id = 4 AND user_id IS NULL AND name = 'Скрытая атака'
  AND data->'weapon_damage' @> '[{"dice":"d6","dice_count_level_divisor":2,"dice_count_rounding":"up"}]'::jsonb
  AND data->'scaling' = (SELECT jsonb_agg(jsonb_build_object('level', lvl, 'value', ((lvl + 1) / 2)::text || 'к6') ORDER BY lvl) FROM generate_series(1,19,2) lvl)
  AND data->'display_scaling' = (SELECT jsonb_agg(jsonb_build_object('level', lvl, 'label', ((lvl + 1) / 2)::text || 'к6') ORDER BY lvl) FROM generate_series(1,19,2) lvl);

-- Separate the numeric rage bonus from its resource note.
UPDATE dndshare.item AS item
SET data = jsonb_set(data, '{scaling}', (
  SELECT jsonb_agg(CASE WHEN row->>'value' = '+4, без ограничений' AND row->>'uses' = '0'
    THEN row || '{"value":"+4","note":"Использования без ограничений"}'::jsonb ELSE row END ORDER BY ord)
  FROM jsonb_array_elements(item.data->'scaling') WITH ORDINALITY AS rows(row, ord)
))
WHERE type_id = 4 AND user_id IS NULL AND name = 'Ярость' AND jsonb_typeof(data->'scaling') = 'array';
