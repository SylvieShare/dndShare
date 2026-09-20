-- Category is explicit on the concrete feat; old uncategorized feats stay so.
UPDATE dndshare.item_type
SET fields = (
  SELECT jsonb_agg(CASE WHEN field->>'key' = 'category' THEN
    field || '{"filter":true,"options":[
      {"value":"origin","label":"Черта происхождения"},
      {"value":"general","label":"Универсальная черта"},
      {"value":"epic_boon","label":"Эпический дар"},
      {"value":"fighting_style","label":"Боевой стиль"}
    ]}'::jsonb
    ELSE field END ORDER BY position)
  FROM jsonb_array_elements(fields) WITH ORDINALITY AS entry(field, position)
)
WHERE id = 7;
