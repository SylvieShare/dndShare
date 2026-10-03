UPDATE dndshare.item_type t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'key' = 'weapon_notes' THEN jsonb_set(f, '{fields}', f->'fields' ||
    '[{"key":"resource_key","name":"Ресурс в заголовке свойства","type":"text","hint":"Явная связь: пустая строка означает основной ресурс; отсутствие поля — без счётчика."}]'::jsonb)
    ELSE f END ORDER BY ord)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY x(f, ord)
) WHERE id IN (1, 19)
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key' = 'weapon_notes'
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(f->'fields') nested WHERE nested->>'key' = 'resource_key'));
