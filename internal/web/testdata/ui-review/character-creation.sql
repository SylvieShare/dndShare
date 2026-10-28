-- A small, complete 2024 catalogue for the real native creation wizard.
INSERT INTO dndshare.source_version(id,source_id,version) VALUES(3,1,'2024');
UPDATE dndshare.item SET name='Обучение',data='{"category":"origin","repeatable":true,"max_use":2,"choices":[{"key":"focus","count":1,"from_suggest_id":16,"ability_bonus":1,"grant_proficiency":"save_prof"}]}' WHERE id=209;
UPDATE dndshare.item SET data='{"speed":30,"feat_choice":{"count":1}}' WHERE id=210;
UPDATE dndshare.item SET name='Учебный класс',name_en='TestClass',data='{"hit_die":"d8"}' WHERE id=211;
INSERT INTO dndshare.item_type(id,name,source_id,fields,icon_image_id) VALUES(11,'Предыстории',1,'[]',2);
INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id) VALUES(220,11,'Учебная предыстория','{"origin_feat_id":209,"ability_options":[1,2,3]}',2);
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(220,1,'native');
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) SELECT id,3,'native' FROM dndshare.item;
SELECT setval(pg_get_serial_sequence('dndshare.item','id'),(SELECT max(id) FROM dndshare.item));
SELECT setval(pg_get_serial_sequence('dndshare.source_version','id'),(SELECT max(id) FROM dndshare.source_version));
