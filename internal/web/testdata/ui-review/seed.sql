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
       jsonb_build_object('description','<p>'||$3||'</p>'),CASE WHEN id=1 THEN 1 END
FROM generate_series(1,205) AS id;
INSERT INTO dndshare.item(id,type_id,name,data)
VALUES (206,1,'Учебный посох','{}'),(207,2,'Дорожная книга','{}'),
       (208,6,'Лесной светлячок','{}'),(209,7,'Внимательный читатель','{}');
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status)
SELECT id,1,'native' FROM dndshare.item;
