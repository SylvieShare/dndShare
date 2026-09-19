-- A choice fills only damage rows without a fixed type; fixed parts are preserved.
UPDATE dndshare.item_type SET fields = (
 SELECT jsonb_agg(CASE WHEN field->>'key' IN ('damage','rolls')
   AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(field->'fields') child WHERE child->>'key'='type_choices')
 THEN jsonb_set(field,'{fields}',
   '[{"key":"type_choices","name":"Типы урона на выбор","type":"suggest_array","suggest_id":12,"hint":"Выберите допустимые типы для меню броска. У зависящих от выбора составляющих формулы оставьте тип пустым; фиксированные типы не меняются."}]'::jsonb || (field->'fields'))
 ELSE field END ORDER BY ord)
 FROM jsonb_array_elements(fields) WITH ORDINALITY fields(field,ord)
) WHERE id=5;
