-- Isolated identity/manual class editing scenario; no live catalogue writes.
INSERT INTO dndshare.item_type(id,name,source_id,fields,icon_image_id)
VALUES(16,'Происхождения',1,'[]',2),(17,'Подклассы',1,'[]',2);
INSERT INTO dndshare.item(id,type_id,name,data,icon_image_id)
VALUES(219,8,'Человек','{"subraces":[213]}',2),
      (213,16,'Северянин','{"race":219}',2),
      (214,9,'Воин','{"subclasses":[215]}',2),
      (215,17,'Школа стража','{"class":214}',2);
INSERT INTO dndshare.item_version_compatibility(item_id,source_version_id,status)
VALUES(219,1,'native'),(213,1,'native'),(214,1,'native'),(215,1,'native');
