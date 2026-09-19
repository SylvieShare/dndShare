-- Minimum final AC is distinct from an unarmored base formula or an AC bonus.
UPDATE dndshare.item_type t SET fields=(
 SELECT jsonb_agg(CASE WHEN f->>'key'='derived_effects' THEN jsonb_set(f,'{fields}',(
  SELECT jsonb_agg(CASE WHEN c->>'key'='kind' THEN jsonb_set(c,'{options}',(c->'options')||
   '[{"value":"armor_minimum","label":"Минимальный итоговый КД"}]'::jsonb) ELSE c END ORDER BY cn)
  FROM jsonb_array_elements(f->'fields') WITH ORDINALITY q(c,cn)
 )) ELSE f END ORDER BY fn)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,fn)
) WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='derived_effects');
