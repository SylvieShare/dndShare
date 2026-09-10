-- Stable links from sheet panels to a named weapon-damage rule.
WITH additions AS (SELECT $level_fields$[{"name": "Уровень для расчётов", "key": "level_source", "type": "select", "default": "bound", "options": [{"value": "bound", "label": "По привязке способности"}, {"value": "class", "label": "Определённый класс"}, {"value": "character", "label": "Общий уровень персонажа"}]}, {"name": "Класс для расчётов", "key": "level_class_id", "type": "item", "item_type": 9, "show_on": {"key": "level_source", "value": "class"}}]$level_fields$::jsonb AS fields)
UPDATE dndshare.item_type t SET fields = (
 SELECT jsonb_agg(CASE
   WHEN f->>'key' = 'weapon_damage' THEN jsonb_set(f, '{fields}', (f->'fields') || jsonb_build_array('{"name": "Ключ", "key": "key", "type": "text", "required": true}'::jsonb))
   WHEN f->>'key' = 'sheet_widgets' THEN jsonb_set(f, '{fields}', (f->'fields') || jsonb_build_array('{"name": "Правило урона", "key": "weapon_damage_key", "type": "text", "show_on": {"key": "value_source", "value": "weapon_damage"}}'::jsonb))
   ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY r(f,ord)
) || additions.fields FROM additions WHERE t.id IN (3,4,7,18);

-- Preserve existing unique keys; assign collision-free keys to unkeyed rules.
WITH keyed AS (
 SELECT i.id, jsonb_agg(r.rule || jsonb_build_object('key', CASE
   WHEN COALESCE(r.rule->>'key','') <> '' AND NOT EXISTS (
     SELECT 1 FROM jsonb_array_elements(i.data->'weapon_damage') WITH ORDINALITY prior(rule,ord)
     WHERE prior.ord < r.ord AND prior.rule->>'key' = r.rule->>'key'
   ) THEN r.rule->>'key'
   ELSE (SELECT candidate.key FROM generate_series(1,jsonb_array_length(i.data->'weapon_damage')+1) n
     CROSS JOIN LATERAL (SELECT 'damage_' || r.ord || CASE WHEN n=1 THEN '' ELSE '_' || n END AS key) candidate
     WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.data->'weapon_damage') existing WHERE existing->>'key'=candidate.key)
     ORDER BY n LIMIT 1)
   END) ORDER BY r.ord) AS rules
 FROM dndshare.item i
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data->'weapon_damage')='array' THEN i.data->'weapon_damage' ELSE '[]'::jsonb END) WITH ORDINALITY r(rule,ord)
 GROUP BY i.id
)
UPDATE dndshare.item i SET data=jsonb_set(i.data,'{weapon_damage}',keyed.rules) FROM keyed WHERE i.id=keyed.id;

-- Existing panels displayed the first rule. Materialize that link exactly once.
UPDATE dndshare.item i SET data=jsonb_set(data,'{sheet_widgets}', (
 SELECT COALESCE(jsonb_agg(CASE WHEN widget->>'value_source'='weapon_damage' AND NOT (widget ? 'weapon_damage_key')
   THEN widget || jsonb_build_object('weapon_damage_key', i.data->'weapon_damage'->0->>'key')
   ELSE widget END ORDER BY ord), '[]'::jsonb)
 FROM jsonb_array_elements(i.data->'sheet_widgets') WITH ORDINALITY rows(widget,ord)
)) WHERE jsonb_typeof(data->'sheet_widgets')='array' AND data->'weapon_damage'->0->>'key' IS NOT NULL;

-- A single owning class becomes an explicit source. Multi-class catalogues keep
-- their declared bindings; unbound traits retain character-level progression.
UPDATE dndshare.item SET data = data || CASE
 WHEN jsonb_array_length(CASE WHEN jsonb_typeof(data->'class_ids')='array' THEN data->'class_ids' ELSE '[]'::jsonb END)=1
 THEN jsonb_build_object('level_source','class','level_class_id', COALESCE(data->'class_ids'->0->'id',data->'class_ids'->0))
 ELSE jsonb_build_object('level_source','bound') END
WHERE type_id IN (3,4,7,18) AND NOT (data ? 'level_source');
