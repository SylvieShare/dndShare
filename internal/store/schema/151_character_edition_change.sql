-- Preserve existing references when changing editions within one system.
CREATE OR REPLACE FUNCTION dndshare.validate_character_edition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE old_document jsonb := '{}'; invalid_id bigint; source_name text;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.source_version_id IS DISTINCT FROM OLD.source_version_id THEN
   IF NOT EXISTS (
    SELECT 1 FROM dndshare.source_version old_v
    JOIN dndshare.source_version new_v ON new_v.source_id=old_v.source_id
    WHERE old_v.id=OLD.source_version_id AND new_v.id=NEW.source_version_id
   ) THEN
    RAISE EXCEPTION 'Редакция должна принадлежать той же игровой системе' USING ERRCODE='PRED1';
   END IF;
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
