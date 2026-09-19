UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key' IN ('damage','rolls') THEN jsonb_set(f,'{fields}',f->'fields'||$field$[
  {"key":"save_dc","name":"Фиксированная сложность","type":"int","min":1,"max":100,"optional":true,
   "hint":"Оставьте пустым для Сл заклинателя. Заполняйте только когда описание прямо задаёт число для этого спасброска."}
 ]$field$::jsonb) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)) WHERE t.id=5;

UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='rolls' THEN jsonb_set(f,'{fields}',(SELECT jsonb_agg(
  CASE WHEN c->>'key'='kind' THEN jsonb_set(c,'{options}',c->'options'||
   '[{"value":"save","label":"Объявить спасбросок без урона"}]'::jsonb)
  ELSE c END ORDER BY cn) FROM jsonb_array_elements(f->'fields') WITH ORDINALITY q(c,cn)))
 ELSE f END ORDER BY n) FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)) WHERE t.id=5;
