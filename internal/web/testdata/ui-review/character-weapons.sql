-- Mechanics for the isolated weapon scenario and paired weapon state.
UPDATE dndshare.item_type SET fields='[{"key":"tags","name":"Свойства","type":"int_by_suggest","suggest_id":14,"multiple":true}]'::jsonb WHERE id=1;
INSERT INTO dndshare.item_type(id,name,source_id,fields,icon_image_id)
VALUES(4,'Классовые способности',1,'[]',2),(19,'Магические предметы',1,'[]',2);
INSERT INTO dndshare.suggest_type(id,name,source_id)
VALUES(4,'Владение оружием',1),(12,'Типы урона',1),(14,'Свойства оружия',1);
INSERT INTO dndshare.suggest(type_id,id,value,color)
VALUES(4,1,'Простое оружие',NULL),(12,1,'Дробящий','#fbbf24'),(12,2,'Огонь','#f97316'),(14,6,'Метательное',NULL),(14,10,'Универсальное',NULL);
UPDATE dndshare.item SET data='{"desc":"<p>Учебное оружие для проверки настоящих бросков.</p>","attacks":[{"count":1,"dice_id":"d6","type":1}],"universe_attacks":[{"count":1,"dice_id":"d8","type":1}],"tags":[6,10],"required_weapon_proficiencies":[1],"range_min":20,"range_max":60}',icon_image_id=2 WHERE id=206;
INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id)
VALUES(213,4,'Учебная сила','{"desc":"<p>Два дополнительных эффекта расходуют общий запас.</p>","class_ids":[211],"level":1,"max_use":3,"rollback_long_rest":true,"weapon_damage":[{"key":"flame","label":"Пламя","dice":"d6","dice_count":1,"damage_type":2,"uses_resource":true,"resource_cost":1,"double_on_critical":true},{"key":"spark","label":"Искра","dice":"d4","dice_count":1,"damage_type":2,"uses_resource":true,"resource_cost":1,"double_on_critical":true}]}',2);
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(213,1,'native');
INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id)
VALUES(214,19,'Посох молнии','{"desc":"<p>Учебное особое применение.</p>","weapon":{"base_item_id":206},"attunement":"none","max_use":3,"weapon_uses":[{"key":"lightning","title":"Разряд","attack_mode":"thrown","range_ft":120,"resource_cost":1,"steps":[{"key":"line","title":"Линия","kind":"damage","dice":"d6","dice_count":4,"damage_type":2,"save":{"ability":2,"dc":13,"half":true},"area":{"shape":"line","width_ft":5}},{"key":"hit","title":"Попадание","kind":"weapon_damage","dice":"d6","dice_count":4,"damage_type":2}]}]}',2);
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(214,1,'native');
UPDATE dndshare.item SET data=data || '{"confirmed_uses":[{"key":"reserve","title":"Резервный разряд","confirm_label":"Подтвердить разряд","resource_cost":1,"cooldown_dawns":1},{"key":"luck","title":"Удача","confirm_label":"Подтвердить удачу","resource_cost":1}],"roll_triggers":[{"event":"any","action":"reroll","scopes":["attack"],"label":"Удача — Посох молнии","use_key":"luck"}],"last_charge":{"dice":"d20","failure_max":20,"consequence":"lose_magic"}}'::jsonb WHERE id=214;
SELECT setval(pg_get_serial_sequence('dndshare.item','id'),(SELECT max(id) FROM dndshare.item));
