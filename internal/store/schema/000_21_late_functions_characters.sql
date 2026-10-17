-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE FUNCTION dndshare.character_rule_item_ids(document jsonb) RETURNS TABLE(item_id bigint)
    LANGUAGE sql STABLE
    AS $_$
 WITH candidates AS (
 SELECT jsonb_path_query(document,'$.values.race.id') v
 UNION ALL SELECT jsonb_path_query(document,'$.values.subrace.id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.background.id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.classes[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.classes[*].subclass.id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_race[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_class[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_feats[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_story[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.spells.tabs[*].class_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.spells.tabs[*].spells[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.spells.grants[*].id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.weapon[*].item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.weapon[*].magic_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.equipped[*].item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.equipped[*].magic_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.sections[*].items[*].item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.sections[*].items[*].magic_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.states[*].effect_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.equipped[*].params.armor_base_item_id')
 UNION ALL SELECT jsonb_path_query(document,'$.values.items.sections[*].items[*].params.armor_base_item_id')
 ), entries AS (
 SELECT jsonb_path_query(document,'$.values.abilities_class[*]') entry
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_race[*]')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_feats[*]')
 UNION ALL SELECT jsonb_path_query(document,'$.values.abilities_story[*]')
 ), choice_refs AS (
 SELECT selected.v FROM entries e
 JOIN dndshare.item i ON i.id=CASE WHEN e.entry->>'id' ~ '^[0-9]{1,18}$' THEN (e.entry->>'id')::bigint END
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(i.data->'choices')='array' THEN i.data->'choices' ELSE '[]' END) choice
 CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(e.entry->'choices'->(choice->>'key'))='array' THEN e.entry->'choices'->(choice->>'key') ELSE '[]' END) selected(v)
 WHERE choice->>'source'='item'
 ), all_refs AS (SELECT v FROM candidates UNION ALL SELECT v FROM choice_refs)
 SELECT DISTINCT (v#>>'{}')::bigint FROM all_refs WHERE (v#>>'{}') ~ '^[0-9]{1,18}$' AND (v#>>'{}')::bigint>0
$_$;
