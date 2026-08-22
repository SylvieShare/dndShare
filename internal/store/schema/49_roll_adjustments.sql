-- Automatic d20 adjustments are declared by abilities and consumed by every
-- compatible sheet roll without checking a feature name or item id at runtime.
WITH addition(field) AS (
  VALUES ('{"name":"Корректировки броска","key":"roll_adjustments","type":"object_array","fields":[{"name":"Вид","key":"kind","type":"select","options":[{"value":"minimum_natural","label":"Минимум на к20"}]},{"name":"Минимум","key":"value","type":"int","default":10},{"name":"Область броска","key":"scope","type":"select","options":[{"value":"ability_check","label":"Проверка характеристики"},{"value":"saving_throw","label":"Спасбросок"},{"value":"attack","label":"Атака"},{"value":"initiative","label":"Инициатива"}]},{"name":"Минимальный ранг владения","key":"minimum_proficiency_rank","type":"int"},{"name":"Пояснение","key":"label","type":"text"},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'roll_adjustments'
  );

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{roll_adjustments}',
  '[{"kind":"minimum_natural","value":10,"scope":"ability_check","minimum_proficiency_rank":1,"label":"Надёжный талант","level":11}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(COALESCE(name_en, '')) = lower('Reliable Talent');
