-- Isolated native inventory scenario, never applied to live catalogue data.
INSERT INTO dndshare.item_type(id,name,source_id,fields,icon_image_id)
VALUES(14,'Инструменты',1,'[]',2);
UPDATE dndshare.item_type SET parent_type_id=2 WHERE id IN (1,14);
INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id)
VALUES(216,14,'Учебный инструмент','{"required_tool_proficiencies":[1]}',2);
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status) VALUES(216,1,'native');
INSERT INTO dndshare.item_icon_preset(id,item_type_id,code,name,purpose,sort_order,image_id)
VALUES(12,2,'native-bag','Тестовая сумка','item',1,2);
