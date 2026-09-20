-- Editable race metadata and the rules shown beside each origin/size option.
UPDATE dndshare.item_type SET fields=fields || '[
 {"key":"creature_type","name":"Тип существа","type":"text"},
 {"key":"size_description","name":"Размер: пояснение и рост","type":"text"}
]'::jsonb WHERE id IN (8,16);

UPDATE dndshare.item_type SET fields=(
 SELECT jsonb_agg(CASE WHEN f->>'key'='variants' THEN jsonb_set(f,'{fields}',(f->'fields') || '[
  {"key":"size_description","name":"Размер и рост","type":"text"},
  {"key":"benefits","name":"Преимущества варианта","type":"object_array","fields":[{"key":"text","name":"Преимущество","type":"text"}]},
  {"key":"description","name":"Подробные правила варианта","type":"description"}
 ]'::jsonb) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(fields) WITH ORDINALITY AS e(f,ord)
) WHERE id=8;
