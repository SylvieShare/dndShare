-- Spell mechanics are isolated from the visual baseline and other action scenarios.
INSERT INTO dndshare.item_type(id,name,source_id,fields,icon_image_id) VALUES(15,'Состояния',1,'[]',2);
INSERT INTO dndshare.suggest_type(id,name,source_id) VALUES(12,'Типы урона',1);
INSERT INTO dndshare.suggest(type_id,id,value,color) VALUES(12,1,'Огонь','#ef4444'),(12,2,'Холод','#38bdf8');
UPDATE dndshare.item SET data=data||'{"time":{"kind":"action"},"range":{"kind":"ranged","distance":60},"components":{"v":true,"s":true},"damage":{"range_attack":true,"dices":[{"count":1,"dice_id":"d6"}],"addon":[{"count":1,"dice_id":"d6"}],"scaling":"slot","type_choices":[1,2],"save_ability":"dex","save_effect":"half"},"rolls":[{"label":"Горение","kind":"damage","dices":[{"count":1,"dice_id":"d4"}]}]}'::jsonb WHERE id=1;
UPDATE dndshare.item SET name='Учебное лечение',data='{"description":"<p>Проверка настоящего лечения и расхода ячейки.</p>","lvl":1,"application_targets":{"self_only":true},"heal":{"dices":[{"count":1,"dice_id":"d4","bonus":1}],"add_mod":true}}' WHERE id=2;
UPDATE dndshare.item SET name='Сотворение страниц',data='{"description":"<p>Создаёт настоящие временные предметы.</p>","lvl":1,"item_creation":[{"key":"pages","title":"Чистые страницы","choose_count":true,"outputs":[{"item":207,"count":2,"per_slot":1,"scaling_step":1,"duration":{"kind":"until_rest"},"on_expire":"vanish"}]}]}' WHERE id=3;
INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id) VALUES(215,15,'Сосредоточенный прицел','{"desc":"<p>Даёт преимущество на атаку и заканчивается после неё.</p>","end_on":["attack"],"derived_effects":[{"kind":"roll_mode","mode":"advantage","scopes":["attack"]}]}',2);
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(215,1,'native');
SELECT setval(pg_get_serial_sequence('dndshare.item','id'),(SELECT max(id) FROM dndshare.item));
