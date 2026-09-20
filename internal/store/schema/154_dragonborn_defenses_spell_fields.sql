-- 143 used options on a legacy text field that only had filter_values, turning
-- rolls.kind into JSON null. Restore the canonical select, including saves.
UPDATE dndshare.item_type t SET fields=(
 SELECT jsonb_agg(CASE WHEN f->>'key'='rolls' THEN jsonb_set(f,'{fields}',(
  SELECT jsonb_agg(CASE WHEN c='null'::jsonb OR c->>'key'='kind' THEN
   '{"key":"kind","name":"Результат","type":"select","default":"effect","options":[
    {"value":"damage","label":"Урон"},{"value":"heal","label":"Лечение"},
    {"value":"effect","label":"Другой результат"},{"value":"save","label":"Объявить спасбросок без урона"}
   ]}'::jsonb ELSE c END ORDER BY cn)
  FROM jsonb_array_elements(f->'fields') WITH ORDINALITY q(c,cn)
 )) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)
) WHERE t.id=5;

UPDATE dndshare.item_type t SET fields=(
 SELECT jsonb_agg(CASE WHEN f->>'key'='variants' THEN jsonb_set(f,'{fields}',f->'fields' || '[
  {"key":"damage_type","name":"Тип урона происхождения","type":"suggest","suggest_id":12},
  {"key":"defenses","name":"Защиты при создании","type":"object_array","fields":[
   {"key":"kind","name":"Защита","type":"select","options":[{"value":"resistance","label":"Сопротивление"},{"value":"immunity","label":"Невосприимчивость"},{"value":"vulnerability","label":"Уязвимость"}]},
   {"key":"damage_type","name":"Тип урона","type":"suggest","suggest_id":12}
  ]}
 ]'::jsonb) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)
) WHERE t.id=8;
