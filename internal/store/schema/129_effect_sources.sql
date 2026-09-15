-- Explicit, author-maintained presentation links. Existing mechanics are unchanged.
UPDATE dndshare.item_type SET fields=fields||'[
 {"key":"application_sources","name":"Источники применения","type":"object_array","fields":[
  {"key":"item","name":"Источник","type":"item","item_type":[1,2,3,4,5,7,8,9,10,11,12,13,14,15,16,17,18,19]},
  {"key":"key","name":"Ключ зависимости","type":"text"},
  {"key":"target","name":"На кого","type":"select","default":"self","options":[{"value":"self","label":"На владельца"},{"value":"other","label":"На цель"}]},
  {"key":"condition","name":"Условие применения","type":"text"}]}
]'::jsonb WHERE id=15;

WITH direct AS (
 SELECT i.id,i.user_id,i.type_id,i.name,link,ordinal
 FROM dndshare.item i CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data->'status_effects')='array' THEN i.data->'status_effects' ELSE '[]'::jsonb END) WITH ORDINALITY l(link,ordinal)
), links AS (
 SELECT * FROM direct
 UNION ALL
 SELECT i.id,i.user_id,i.type_id,i.name,jsonb_build_object('effect',i.data->'on_end_effect','key','on_end_effect','target','self','condition','После завершения эффекта'),1::bigint
 FROM dndshare.item i WHERE i.data#>>'{on_end_effect,id}' IS NOT NULL
 UNION ALL
 SELECT i.id,i.user_id,i.type_id,i.name,link,ordinal
 FROM dndshare.item i CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data#>'{consumption,choices}')='array' THEN i.data#>'{consumption,choices}' ELSE '[]'::jsonb END) c(choice)
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(choice->'status_effects')='array' THEN choice->'status_effects' ELSE '[]'::jsonb END) WITH ORDINALITY l(link,ordinal)
 UNION ALL
 SELECT i.id,i.user_id,i.type_id,i.name,spell.link,spell.ordinal
 FROM dndshare.item i JOIN direct spell ON spell.type_id=5 AND spell.id::text=i.data#>>'{consumption,spell,id}'
 WHERE (spell.user_id IS NULL OR spell.user_id=i.user_id)
 AND (COALESCE(i.data#>>'{consumption,spell_effect_key}','')='' OR spell.link->>'key'=i.data#>>'{consumption,spell_effect_key}')
), grouped AS (
 SELECT e.id, jsonb_agg(jsonb_build_object('item',jsonb_build_object('id',l.id),'key',COALESCE(NULLIF(l.link->>'key',''),l.ordinal::text),'target',COALESCE(l.link->>'target','self'),'condition',COALESCE(l.link->>'condition','')) ORDER BY l.name,l.id,l.ordinal) AS sources,
 min(l.id) FILTER(WHERE l.type_id=5) AS spell_id,
 count(DISTINCT l.id) FILTER(WHERE l.type_id=5) AS spell_count
 FROM dndshare.item e JOIN links l ON COALESCE(l.link#>>'{effect,id}',l.link->>'effect')=e.id::text
 WHERE e.type_id=15 AND (l.user_id IS NULL OR l.user_id=e.user_id)
 GROUP BY e.id
)
UPDATE dndshare.item e SET data=e.data||jsonb_build_object('application_sources',g.sources)
FROM grouped g WHERE e.id=g.id;

WITH candidates AS (
 SELECT e.id,min(spell.id) AS spell_id
 FROM dndshare.item e
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.data->'application_sources','[]'::jsonb)) ref
 JOIN dndshare.item spell ON spell.id::text=COALESCE(ref#>>'{item,id}',ref->>'item') AND spell.type_id=5
 WHERE e.type_id=15 AND (spell.icon_image_id IS NOT NULL OR spell.icon_svg_id IS NOT NULL)
 GROUP BY e.id HAVING count(DISTINCT spell.id)=1
)
UPDATE dndshare.item e SET icon_image_id=spell.icon_image_id,icon_svg_id=spell.icon_svg_id
FROM candidates c JOIN dndshare.item spell ON spell.id=c.spell_id WHERE e.id=c.id;

-- Follow-up effects (e.g. haste lethargy) share their originating effect's icon.
WITH candidates AS (
 SELECT e.id,min(source.id) AS source_id FROM dndshare.item e
 CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.data->'application_sources','[]'::jsonb)) ref
 JOIN dndshare.item source ON source.id::text=COALESCE(ref#>>'{item,id}',ref->>'item') AND source.type_id=15
 WHERE e.type_id=15 AND e.icon_image_id IS NULL AND e.icon_svg_id IS NULL
 AND (source.icon_image_id IS NOT NULL OR source.icon_svg_id IS NOT NULL)
 GROUP BY e.id HAVING count(DISTINCT source.id)=1
)
UPDATE dndshare.item e SET icon_image_id=source.icon_image_id,icon_svg_id=source.icon_svg_id
FROM candidates c JOIN dndshare.item source ON source.id=c.source_id WHERE e.id=c.id;
