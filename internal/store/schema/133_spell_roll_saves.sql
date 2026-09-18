-- Separate spell damage stages already use the same runtime roll contract.
-- Expose their saving throw metadata in the editor, preserving field order.
UPDATE dndshare.item_type t SET fields = (
 SELECT jsonb_agg(CASE WHEN field->>'key' = 'rolls' THEN
   jsonb_set(field, '{fields}', (field->'fields') || COALESCE((
     SELECT jsonb_agg(save_field ORDER BY position)
     FROM jsonb_array_elements((SELECT d->'fields' FROM jsonb_array_elements(t.fields) d WHERE d->>'key'='damage')) WITH ORDINALITY s(save_field, position)
     WHERE save_field->>'key' IN ('save_ability','save_effect','save_condition')
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(field->'fields') existing WHERE existing->>'key'=save_field->>'key')
   ), '[]'::jsonb)) ELSE field END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY f(field,ord)
) WHERE t.id=5;
