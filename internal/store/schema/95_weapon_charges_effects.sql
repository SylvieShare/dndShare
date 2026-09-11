-- Resource costs and target-side effects share the existing dependency model.
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='weapon_damage' THEN jsonb_set(f,'{fields}',
 COALESCE(f->'fields','[]'::jsonb) || COALESCE((SELECT jsonb_agg(n) FROM jsonb_array_elements($fields$[{"key": "damage_type", "name": "Тип дополнительного урона", "type": "suggest", "suggest_id": 12, "hint": "Если не выбран, используется тип урона оружия."}, {"key": "uses_resource", "name": "Расходует ресурс", "type": "bool", "hint": "Ресурс списывается при запуске броска урона, а не при включении переключателя."}, {"key": "resource_key", "name": "Ресурс", "type": "text", "hint": "Пустое значение — основной ресурс этого предмета или способности."}, {"key": "resource_cost", "name": "Стоимость удара", "type": "int", "default": 1, "hint": "Число зарядов за один бросок урона. Критический удар не увеличивает стоимость."}]$fields$::jsonb) n
 WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(f->'fields','[]'::jsonb)) old WHERE old->>'key'=n->>'key')), '[]'::jsonb)) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS rows(f,ord))
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='weapon_damage');

UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='status_effects' THEN jsonb_set(f,'{fields}',
 COALESCE(f->'fields','[]'::jsonb) || COALESCE((SELECT jsonb_agg(n) FROM jsonb_array_elements($fields$[{"key": "target", "name": "На кого накладывается", "type": "select", "default": "self", "options": [{"value": "self", "label": "На владельца"}, {"value": "other", "label": "На другое существо"}], "hint": "Эффект на другое существо не включается на листе владельца предмета."}, {"key": "condition", "name": "Условие наложения", "type": "text", "hint": "Укажите попадание, спасбросок и другие условия, которые проверяет игрок."}, {"key": "weapon_damage_key", "name": "Связанный дополнительный урон", "type": "text", "hint": "Переключатель урона этого предмета. Связь поясняет условие, но не накладывает эффект автоматически."}]$fields$::jsonb) n
 WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(f->'fields','[]'::jsonb)) old WHERE old->>'key'=n->>'key')), '[]'::jsonb)) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY AS rows(f,ord))
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='status_effects');

INSERT INTO dndshare.item(name,name_en,type_id,data)
 SELECT 'Иссушение посоха','Staff of Withering',15,$effect${"code": "staff_withering", "desc": "<p>На 1 час вы совершаете с помехой проверки Силы и Телосложения (включая навыки на этих характеристиках), а также спасброски Силы и Телосложения.</p>", "polarity": "negative", "color": "#a78bfa", "stacking": "single", "duration": {"kind": "hours", "value": 1}, "derived_effects": [{"kind": "roll_mode", "mode": "disadvantage", "scopes": ["ability_check", "skill_check", "saving_throw"], "ability_ids": [1, 3], "label": "Иссушение посоха"}]}$effect$::jsonb
 WHERE EXISTS(SELECT 1 FROM dndshare.item WHERE id=86 AND type_id=19 AND user_id IS NULL AND name='Посох иссушения')
 AND NOT EXISTS(SELECT 1 FROM dndshare.item WHERE type_id=15 AND user_id IS NULL AND data->>'code'='staff_withering');

UPDATE dndshare.item i SET data=i.data
 || jsonb_build_object('max_use',3,'recharge_note','На рассвете восстанавливается 1к3 заряда, максимум 3. Восстановление отмечается вручную.')
 || jsonb_build_object('weapon_damage',COALESCE(i.data->'weapon_damage','[]'::jsonb) ||
 CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(i.data->'weapon_damage','[]'::jsonb)) r WHERE r->>'key'='withering') THEN '[]'::jsonb ELSE $damage$[{"key": "withering", "label": "Иссушающий удар", "dice": "d10", "dice_count": 2, "damage_type": 10, "weapon_kind": "melee", "uses_resource": true, "resource_cost": 1, "double_on_critical": true, "condition": "При попадании посохом. Дополнительный урон некротической энергией наносится независимо от спасброска цели."}]$damage$::jsonb END)
 || jsonb_build_object('status_effects',COALESCE(i.data->'status_effects','[]'::jsonb) ||
 CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(i.data->'status_effects','[]'::jsonb)) r WHERE r->>'key'='withering') THEN '[]'::jsonb ELSE jsonb_build_array(jsonb_build_object(
 'key','withering','effect',jsonb_build_object('id',effect.id),'target','other','weapon_damage_key','withering',
 'condition','Попадание посохом, потрачен 1 заряд на иссушающий удар; цель провалила спасбросок Телосложения Сл 15. Длительность — 1 час.')) END)
 FROM (SELECT id FROM dndshare.item WHERE type_id=15 AND user_id IS NULL AND data->>'code'='staff_withering' ORDER BY id LIMIT 1) effect
 WHERE i.id=86 AND i.type_id=19 AND i.user_id IS NULL AND i.name='Посох иссушения';
