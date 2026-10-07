UPDATE dndshare.battle_map SET document = jsonb_set(document, '{areas}',
    (SELECT COALESCE(jsonb_agg(area || jsonb_build_object('color', COALESCE(area->>'color', '#8b5cf6')) ORDER BY ord), '[]'::jsonb)
     FROM jsonb_array_elements(document->'areas') WITH ORDINALITY AS source(area, ord)));
UPDATE dndshare.session_map SET document = jsonb_set(document, '{areas}',
    (SELECT COALESCE(jsonb_agg(area || jsonb_build_object('color', COALESCE(area->>'color', '#8b5cf6')) ORDER BY ord), '[]'::jsonb)
     FROM jsonb_array_elements(document->'areas') WITH ORDINALITY AS source(area, ord)));
