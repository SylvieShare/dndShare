-- Cost keeps an optional exact value and an optional min/max range together,
-- with one suggest_id currency shared by both.
UPDATE dndshare.item_type t SET fields = (
  SELECT jsonb_agg(CASE WHEN f->>'key' = 'cost' THEN f || '{"allow_range":true,"hint":"Точная цена value и диапазон min/max независимы; можно заполнить один или оба. Валюта suggest_id общая. При покупке используется только value."}'::jsonb ELSE f END ORDER BY ord)
  FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS x(f, ord)
) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key' = 'cost');

UPDATE dndshare.item_type SET fields = fields || '{"key":"weapon_notes","name":"Памятки под оружием","hint":"Отдельные правила и проклятия этого экземпляра. Памятка показывает описание; спасброски и принуждение выполняются игроком.","type":"object_array","fields":[{"key":"key","name":"Ключ","type":"text","required":true},{"key":"title","name":"Название","type":"text","required":true},{"key":"kind","name":"Тип карточки","type":"select","default":"rule","required":true,"options":[{"value":"rule","label":"Свойство или правило"},{"value":"curse","label":"Проклятие"}]},{"key":"when","name":"Когда показывать","type":"select","default":"active","required":true,"options":[{"value":"active","label":"Когда свойства предмета активны"},{"value":"attuned","label":"После настройки, в том числе в рюкзаке"},{"value":"always","label":"Пока предмет у персонажа"}]},{"key":"description","name":"Описание правила","type":"description","required":true},{"key":"requirements","name":"Короткие условия","type":"text_array"}]}'::jsonb
WHERE id IN (1, 19) AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key' = 'weapon_notes');
