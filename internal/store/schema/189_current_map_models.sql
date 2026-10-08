-- One mutable current model per logical definition. Keep the first UUID stable.
CREATE TEMP TABLE current_map_model_ids AS
SELECT id AS old_id,
       first_value(id) OVER (PARTITION BY definition_id ORDER BY version,id) AS current_id
FROM dndshare.map_model;
CREATE TEMP TABLE current_map_model_values AS
SELECT DISTINCT ON (definition_id) * FROM dndshare.map_model
ORDER BY definition_id,version DESC,id;
UPDATE dndshare.map_model current
SET name=latest.name,tile_type=latest.tile_type,geometry=latest.geometry,assets=latest.assets
FROM current_map_model_values latest, current_map_model_ids ids
WHERE ids.old_id=latest.id AND current.id=ids.current_id;

CREATE FUNCTION pg_temp.current_model_document(doc jsonb) RETURNS jsonb LANGUAGE sql AS $$
 SELECT jsonb_set(jsonb_set(doc, '{tiles}',
  (SELECT COALESCE(jsonb_agg(tile || jsonb_build_object('modelId',COALESCE(ids.current_id::text,tile->>'modelId')) ORDER BY ord),'[]'::jsonb)
   FROM jsonb_array_elements(doc->'tiles') WITH ORDINALITY source(tile,ord)
   LEFT JOIN current_map_model_ids ids ON ids.old_id::text=tile->>'modelId')), '{objects}',
  (SELECT COALESCE(jsonb_agg(CASE WHEN ids.current_id IS NULL THEN object ELSE object || jsonb_build_object('modelId',ids.current_id::text) END ORDER BY ord),'[]'::jsonb)
   FROM jsonb_array_elements(doc->'objects') WITH ORDINALITY source(object,ord)
   LEFT JOIN current_map_model_ids ids ON ids.old_id::text=object->>'modelId'))
$$;
UPDATE dndshare.battle_map SET document=pg_temp.current_model_document(document);
UPDATE dndshare.session_map SET document=pg_temp.current_model_document(document);
DELETE FROM dndshare.battle_map_model;
INSERT INTO dndshare.battle_map_model(map_id,model_id)
SELECT DISTINCT map.id,ids.current_id FROM dndshare.battle_map map
CROSS JOIN LATERAL (SELECT value->>'modelId' model_id FROM jsonb_array_elements(map.document->'tiles') UNION SELECT value->>'modelId' FROM jsonb_array_elements(map.document->'objects')) members
JOIN current_map_model_ids ids ON ids.old_id::text=members.model_id;
DELETE FROM dndshare.session_map_model;
INSERT INTO dndshare.session_map_model(map_id,model_id)
SELECT DISTINCT map.id,ids.current_id FROM dndshare.session_map map
CROSS JOIN LATERAL (SELECT value->>'modelId' model_id FROM jsonb_array_elements(map.document->'tiles') UNION SELECT value->>'modelId' FROM jsonb_array_elements(map.document->'objects')) members
JOIN current_map_model_ids ids ON ids.old_id::text=members.model_id;
DELETE FROM dndshare.map_model model USING current_map_model_ids ids WHERE model.id=ids.old_id AND ids.old_id<>ids.current_id;
ALTER TABLE dndshare.map_model DROP COLUMN version;
ALTER TABLE dndshare.map_model ADD CONSTRAINT map_model_one_definition UNIQUE(definition_id);
DROP TABLE current_map_model_ids;
DROP TABLE current_map_model_values;
