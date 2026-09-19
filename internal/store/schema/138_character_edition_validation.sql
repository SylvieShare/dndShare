ALTER TABLE dndshare."char" ADD COLUMN cloned_from_char_id bigint REFERENCES dndshare."char"(id) ON DELETE SET NULL;
-- Validate newly introduced rule references at the database boundary, covering
-- autosave, patch, MCP and server-side inventory operations atomically.
CREATE OR REPLACE FUNCTION dndshare.character_rule_item_ids(document jsonb)
RETURNS TABLE(item_id bigint) LANGUAGE sql STABLE AS $$
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
 UNION ALL SELECT jsonb_path_query(document,'$.values.potions[*].item_id')
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
$$;

CREATE OR REPLACE FUNCTION dndshare.validate_character_edition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_document jsonb := '{}'; invalid_id bigint; source_name text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.source_version_id IS DISTINCT FROM OLD.source_version_id THEN
   RAISE EXCEPTION 'Редакцию существующего персонажа нельзя менять без переноса' USING ERRCODE='PRED1';
  END IF;
  old_document := OLD.data::jsonb;
 ELSIF NEW.cloned_from_char_id IS NOT NULL THEN
  SELECT c.data INTO old_document FROM dndshare."char" c WHERE c.id=NEW.cloned_from_char_id AND c.user_id=NEW.user_id AND c.source_version_id=NEW.source_version_id;
  old_document := COALESCE(old_document,'{}');
 END IF;
 SELECT s.name INTO source_name FROM dndshare.source_version v JOIN dndshare.source s ON s.id=v.source_id WHERE v.id=NEW.source_version_id;
 IF source_name IS NULL OR lower(source_name)<>'dnd5e' THEN RETURN NEW; END IF;
 SELECT n.item_id INTO invalid_id FROM dndshare.character_rule_item_ids(NEW.data::jsonb) n
 WHERE NOT EXISTS(SELECT 1 FROM dndshare.character_rule_item_ids(old_document) o WHERE o.item_id=n.item_id)
 AND NOT EXISTS(
  SELECT 1 FROM dndshare.item i
  JOIN dndshare.item_version_compatibility c ON c.item_id=i.id AND c.source_version_id=NEW.source_version_id
  WHERE i.id=n.item_id AND (i.user_id IS NULL OR i.user_id=NEW.user_id) AND NOT i.hidden
  AND c.status IN ('native','compatible')
  AND (COALESCE(NEW.data::jsonb#>>'{settings,contentSources,mode}','all')<>'selected'
    OR i.user_id IS NOT NULL
    OR NOT EXISTS(SELECT 1 FROM dndshare.item_content_source l WHERE l.item_id=i.id)
    OR EXISTS(SELECT 1 FROM dndshare.item_content_source l WHERE l.item_id=i.id
      AND (NEW.data::jsonb#>'{settings,contentSources,ids}') @> jsonb_build_array(l.content_source_id)))
 ) LIMIT 1;
 IF invalid_id IS NOT NULL THEN
  RAISE EXCEPTION 'Объект % недоступен для редакции или источников персонажа',invalid_id USING ERRCODE='PRED1';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS character_edition_validation ON dndshare."char";
CREATE TRIGGER character_edition_validation BEFORE INSERT OR UPDATE OF data,source_version_id ON dndshare."char"
 FOR EACH ROW EXECUTE FUNCTION dndshare.validate_character_edition();
