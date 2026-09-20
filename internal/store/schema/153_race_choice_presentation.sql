-- A choice stays a rule source, but is shown only by the selection controls
-- during creation/level-up, rather than a duplicate feature tile.
UPDATE dndshare.item_type SET fields=fields || '[
 {"key":"choice_only","name":"Показывать только выбор при получении","type":"bool"}
]'::jsonb WHERE id IN (3,4);

-- Innate spells can share the casting choice of a named ability source.
UPDATE dndshare.item_type SET fields=(
 SELECT jsonb_agg(CASE WHEN f->>'key'='granted_spells' THEN jsonb_set(f,'{fields}',(f->'fields') || '[
  {"key":"ability_choice_key","name":"Выбор заклинательной характеристики","type":"text"},
  {"key":"ability_choice_source","name":"Способность с выбором характеристики","type":"item","item_type":3}
 ]'::jsonb) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f,ord)
) WHERE id IN (3,4,7,18);
