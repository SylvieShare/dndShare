-- Session maps own the complete editable scene and remember their library source.
ALTER TABLE dndshare.session_map ADD COLUMN source jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source)='object');
UPDATE dndshare.session_map s SET source=jsonb_build_object(
 'id', COALESCE((SELECT b.id::text FROM dndshare.battle_map b WHERE b.name=s.name AND b.document=s.document LIMIT 1),
 CASE s.name WHEN 'Пещерные залы' THEN 'system-cave' WHEN 'Пустая пещера' THEN 'system-stalagmites' ELSE '' END),
 'name',s.name,'system',NOT EXISTS(SELECT 1 FROM dndshare.battle_map b WHERE b.name=s.name AND b.document=s.document) AND s.name IN ('Пещерные залы','Пустая пещера'));
-- Materialize existing session visibility and lighting into the scene before removing overrides.
UPDATE dndshare.session_map SET document=jsonb_set(jsonb_set(jsonb_set(jsonb_set(document,
 '{areas}',(SELECT COALESCE(jsonb_agg(CASE WHEN state->'areas' ? (a->>'id') THEN a||jsonb_build_object('hidden',NOT (state->'areas'->>(a->>'id'))::boolean) ELSE a END ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(document->'areas') WITH ORDINALITY entries(a,n))),
 '{lightingEnabled}',COALESCE(state->'lighting'->'enabled',document->'lightingEnabled','false'::jsonb)),
 '{sun}',COALESCE(NULLIF(state->'lighting'->'sun','null'::jsonb),document->'sun','{"enabled":true,"angle":45,"elevation":42}'::jsonb)),
 '{lights}',(SELECT COALESCE(jsonb_agg(CASE WHEN state->'lighting'->'lights' ? (l->>'id') THEN l||jsonb_build_object('enabled',(state->'lighting'->'lights'->>(l->>'id'))::boolean) ELSE l END ORDER BY n),'[]'::jsonb) FROM jsonb_array_elements(document->'lights') WITH ORDINALITY entries(l,n))),
 state=state-'areas'-'lighting';
