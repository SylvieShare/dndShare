-- An effect of a spell can belong to its casting or to a later impact.
-- Empty/any deliberately allows both entry points (e.g. a stand-alone condition).
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='status_effects' THEN jsonb_set(f,'{fields}',f->'fields'||$field$[
  {"key":"apply_on","name":"Когда применять","type":"select","default":"any","options":[
   {"value":"any","label":"При использовании или из хроники"},
   {"value":"cast","label":"Только при использовании"},
   {"value":"impact","label":"После броска — из хроники"}],
   "hint":"Личное усиление при сотворении не должно попадать на жертву атаки. Выберите отдельно этап для каждого эффекта."}
 ]$field$::jsonb) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n))
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='status_effects');
