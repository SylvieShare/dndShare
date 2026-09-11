-- A variable resource selection repeats one damage rule atomically.
WITH spec AS (SELECT $units_field${"key": "resource_units_max", "name": "Максимум ячеек расхода", "type": "int", "hint": "Выбор от 0 до этого количества вместо галочки. Каждая ячейка добавляет указанные кости и расходует указанную стоимость ресурса."}$units_field$::jsonb AS field)
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='weapon_damage' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'fields') c WHERE c->>'key'='resource_units_max')
 THEN jsonb_set(f,'{fields}',(f->'fields')||jsonb_build_array(spec.field)) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY rows(f,ord)) FROM spec
WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='weapon_damage');

UPDATE dndshare.item i SET data=jsonb_set(i.data,'{weapon_damage}',COALESCE(i.data->'weapon_damage','[]'::jsonb)||jsonb_build_array($striking${"key": "striking", "label": "Усилить удар", "dice": "d6", "dice_count": 1, "damage_type": 12, "weapon_kind": "melee", "uses_resource": true, "resource_cost": 1, "resource_units_max": 3, "double_on_critical": true, "condition": "При попадании рукопашной атакой этим посохом. Каждая выбранная ячейка добавляет 1к6 силовым полем и расходует 1 заряд."}$striking$::jsonb))
WHERE i.id=189 AND i.name='Посох ударов' AND i.type_id=19 AND i.user_id IS NULL
 AND jsonb_typeof(COALESCE(i.data->'weapon_damage','[]'::jsonb))='array'
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(i.data->'weapon_damage','[]'::jsonb)) r WHERE r->>'key'='striking');
