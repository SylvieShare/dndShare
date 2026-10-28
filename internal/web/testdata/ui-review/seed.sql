-- Test-only data, applied after current DDL in a random internal/testdb database.
INSERT INTO dndshare.storage_image(id,url,type,mime_type)
VALUES (1,$1||'/__test/cover.svg','ITEM_COVER','image/svg+xml'),
       (2,$1||'/__test/emblem.svg','ITEM_ICON','image/svg+xml');
INSERT INTO dndshare.item_type(id,name,source_id,description,fields,icon_image_id)
VALUES (1,'Оружие',1,'Снаряжение для учебного приключения.','[]',2),
       (2,'Вещи',1,'Полезные предметы в дороге.','[]',2),
       (5,'Заклинания',1,'Магия, свет и маленькие чудеса.',
        '[{"key":"description","name":"Описание","type":"description"}]',2),
       (6,'Бестиарий',1,'Обитатели вымышленного мира.','[]',2),
       (7,'Черты',1,'Таланты и особые умения.','[]',2);
INSERT INTO dndshare.item(id,type_id,name,data,cover_image_id)
SELECT id,5,CASE WHEN id=1 THEN $2 ELSE 'Заклинание '||lpad(id::text,3,'0') END,
       jsonb_build_object('description','<p>'||$3||'</p>','lvl',CASE WHEN id=1 THEN 1 ELSE 0 END),CASE WHEN id=1 THEN 1 END
FROM generate_series(1,205) AS id;
UPDATE dndshare.item SET name_en='flame_primer' WHERE id=1;
INSERT INTO dndshare.item(id,type_id,name,data)
VALUES (206,1,'Учебный посох','{}'),(207,2,'Дорожная книга','{}'),
       (208,6,'Лесной светлячок','{}'),(209,7,'Внимательный читатель','{}');
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status)
SELECT id,1,'native' FROM dndshare.item;

INSERT INTO dndshare.source(id,name) VALUES(2,'Vampire: TM');
INSERT INTO dndshare.source_version(id,source_id,version) VALUES(2,2,'V20');
INSERT INTO dndshare.char_template(name) VALUES('DND5'),('VTM20');
INSERT INTO dndshare.suggest_type(id,name,source_id) VALUES(15,'Навыки',1),(16,'Характеристики',1),(17,'Монеты',1);
INSERT INTO dndshare.suggest(type_id,id,value,color)
SELECT 16,ordinality,value,'#b9a8ff' FROM unnest(ARRAY['Сила','Ловкость','Телосложение','Интеллект','Мудрость','Харизма']) WITH ORDINALITY AS s(value,ordinality);
INSERT INTO dndshare.suggest(type_id,id,value)
SELECT 15,ordinality,value FROM unnest(ARRAY['Атлетика','Акробатика','Ловкость рук','Скрытность','Анализ','История','Магия','Природа','Религия','Внимательность','Выживание','Медицина','Проницательность','Уход за животными','Выступление','Запугивание','Обман','Убеждение']) WITH ORDINALITY AS s(value,ordinality);
UPDATE dndshare.item SET data='{"desc":"<p>За каждый уровень персонаж получает два дополнительных хита.</p>","hp_bonuses":[{"level":1,"per_level":2}]}' WHERE id=209;
INSERT INTO dndshare.item_type(id,name,source_id,fields,icon_image_id) VALUES(8,'Расы',1,'[]',2),(9,'Классы',1,'[]',2);
INSERT INTO dndshare.item(id,type_id,name,data) VALUES(210,8,'Эльф','{}'),(211,9,'Волшебник','{}');
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(210,1,'native'),(211,1,'native');

INSERT INTO dndshare."char"(id,uuid,user_id,template_id,data,public_visible,source_version_id,icon_image_id)
SELECT ordinality,(entry->>'uuid')::uuid,(SELECT id FROM dndshare.users WHERE login='native_tester'),
       (SELECT id FROM dndshare.char_template WHERE name=entry->>'templateName'),entry->'data',false,
       (entry->>'sourceVersionId')::bigint,(entry->>'iconImageId')::bigint
FROM jsonb_array_elements($4::jsonb) WITH ORDINALITY AS s(entry,ordinality);
INSERT INTO dndshare.user_tutorial(user_id,flow_id,source_key,device,revision,status)
SELECT u.id,'character','edition:'||edition,device,58,'completed'
FROM dndshare.users u CROSS JOIN generate_series(1,2) edition CROSS JOIN unnest(ARRAY['mobile','desktop']) device
WHERE u.login='native_tester';

-- Character CRUD scenarios create copies through the real API after explicit seed ids.
SELECT setval(pg_get_serial_sequence('dndshare."char"','id'),(SELECT max(id) FROM dndshare."char"));

-- Canonical currencies are required by real money-transfer commands.
INSERT INTO dndshare.suggest(type_id,id,value) VALUES
(17,1,'Медные монеты'),(17,2,'Серебряные монеты'),(17,3,'Золотые монеты'),(17,4,'Электрумовые монеты'),(17,5,'Платиновые монеты');

-- Explicit media/catalogue fixture ids must not collide with later API inserts.
SELECT setval(pg_get_serial_sequence('dndshare.storage_image','id'),(SELECT max(id) FROM dndshare.storage_image));
SELECT setval(pg_get_serial_sequence('dndshare.item','id'),(SELECT max(id) FROM dndshare.item));
