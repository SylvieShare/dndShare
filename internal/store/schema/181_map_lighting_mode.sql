UPDATE dndshare.battle_map SET document = document || jsonb_build_object(
  'lightingEnabled', false,
  'lights', (SELECT COALESCE(jsonb_agg(light || '{"showMarker":true}'::jsonb ORDER BY ord), '[]'::jsonb)
             FROM jsonb_array_elements(document->'lights') WITH ORDINALITY AS source(light, ord))
);
UPDATE dndshare.session_map SET document = document || jsonb_build_object(
  'lightingEnabled', false,
  'lights', (SELECT COALESCE(jsonb_agg(light || '{"showMarker":true}'::jsonb ORDER BY ord), '[]'::jsonb)
             FROM jsonb_array_elements(document->'lights') WITH ORDINALITY AS source(light, ord))
);
