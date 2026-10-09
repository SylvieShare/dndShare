-- Session maps own the complete editable scene and remember their library source.
ALTER TABLE dndshare.session_map ADD COLUMN source jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source)='object');
UPDATE dndshare.session_map s SET source=jsonb_build_object(
 'id', COALESCE((SELECT b.id::text FROM dndshare.battle_map b WHERE b.name=s.name AND b.document=s.document LIMIT 1),
 CASE s.name WHEN 'Пещерные залы' THEN 'system-cave' WHEN 'Пустая пещера' THEN 'system-stalagmites' ELSE '' END),
 'name',s.name,'system',NOT EXISTS(SELECT 1 FROM dndshare.battle_map b WHERE b.name=s.name AND b.document=s.document) AND s.name IN ('Пещерные залы','Пустая пещера'));
-- A hydrated builtin may have an override even when it was never persisted in
-- document.lights. Seed its identity/activation; normal builtin hydration restores
-- the current model-derived position and fields before any API response.
WITH owners AS (
 SELECT s.id AS map_id,'tile'::text AS kind,t AS owner FROM dndshare.session_map s CROSS JOIN LATERAL jsonb_array_elements(s.document->'tiles') t
 UNION ALL
 SELECT s.id,'object',o FROM dndshare.session_map s CROSS JOIN LATERAL jsonb_array_elements(s.document->'objects') o WHERE o->>'modelId' IS NOT NULL
), templates AS (
 SELECT o.*,l AS template,'builtin-'||substr(encode(sha256(convert_to(o.kind||':'||(o.owner->>'id')||':'||(l->>'key'),'UTF8')),'hex'),1,31) AS light_id
 FROM owners o JOIN dndshare.map_model m ON m.id::text=o.owner->>'modelId'
 JOIN dndshare.map_model_definition d ON d.id=m.definition_id
 CROSS JOIN LATERAL jsonb_array_elements(d.default_lights) l
), missing AS (
 SELECT t.map_id,jsonb_agg(jsonb_build_object(
  'id',t.light_id,'builtinKey',t.template->>'key','anchor',jsonb_build_object('kind',t.kind,'id',t.owner->>'id'),
  'name',t.template->>'name','kind',t.template->>'kind','color',t.template->>'color',
  'x',0,'y',0,'elevation',0,'height',t.template->'position'->2,
  'intensity',t.template->'intensity','radius',t.template->'radius','enabled',s.state->'lighting'->'lights'->t.light_id,
  'flicker',t.template->'flicker','offset',jsonb_build_array(0,0),'shadows',false,'showMarker',false
 ) ORDER BY t.light_id) AS lights
 FROM templates t JOIN dndshare.session_map s ON s.id=t.map_id
 WHERE s.state->'lighting'->'lights' ? t.light_id
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.document->'lights') existing WHERE existing->>'id'=t.light_id)
 GROUP BY t.map_id
)
UPDATE dndshare.session_map s SET document=jsonb_set(s.document,'{lights}',COALESCE(s.document->'lights','[]'::jsonb)||missing.lights)
FROM missing WHERE s.id=missing.map_id;

-- Materialize existing session visibility and lighting into the scene before removing overrides.
UPDATE dndshare.session_map SET document=jsonb_set(jsonb_set(jsonb_set(jsonb_set(document,
 '{areas}',(SELECT COALESCE(jsonb_agg(CASE WHEN state->'areas' ? (a->>'id') THEN a||jsonb_build_object('hidden',NOT (state->'areas'->>(a->>'id'))::boolean) ELSE a END ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(document->'areas') WITH ORDINALITY entries(a,n))),
 '{lightingEnabled}',COALESCE(state->'lighting'->'enabled',document->'lightingEnabled','false'::jsonb)),
 '{sun}',COALESCE(NULLIF(state->'lighting'->'sun','null'::jsonb),document->'sun','{"enabled":true,"angle":45,"elevation":42}'::jsonb)),
 '{lights}',(SELECT COALESCE(jsonb_agg(CASE WHEN state->'lighting'->'lights' ? (l->>'id') THEN l||jsonb_build_object('enabled',(state->'lighting'->'lights'->>(l->>'id'))::boolean) ELSE l END ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(document->'lights') WITH ORDINALITY entries(l,n))),
 state=state-'areas'-'lighting';
