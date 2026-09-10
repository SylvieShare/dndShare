-- Explain the explicit virtual-weapon action in catalogue authoring.
-- Instance membership is an optional params.weapon_enabled boolean (absent = off).
UPDATE dndshare.item_type SET fields=(
  SELECT jsonb_agg(CASE WHEN field->>'key'='weapon'
    THEN jsonb_set(field, '{hint}', '"Добавьте экземпляр через «Переместить в оружие» в меню инвентаря. Основа задаёт урон и владение; магические свойства и ручные поправки дополняют её. Одна экипировка не добавляет атаку."'::jsonb)
    ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(fields) WITH ORDINALITY f(field,ord)
) WHERE id=19;
