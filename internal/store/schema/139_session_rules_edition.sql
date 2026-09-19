ALTER TABLE dndshare."session" ADD COLUMN source_version_id bigint REFERENCES dndshare.source_version(id);
UPDATE dndshare."session" s SET source_version_id=(SELECT v.id FROM dndshare.source_version v WHERE v.source_id=s.system_id ORDER BY (v.version='2014') DESC,v.id LIMIT 1);
CREATE INDEX idx_session_rules_edition ON dndshare."session"(source_version_id);
CREATE FUNCTION dndshare.validate_session_edition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.system_id IS NULL THEN NEW.source_version_id := NULL;
 ELSIF NEW.source_version_id IS NULL THEN
  SELECT v.id INTO NEW.source_version_id FROM dndshare.source_version v WHERE v.source_id=NEW.system_id ORDER BY (v.version='2014') DESC,v.id LIMIT 1;
 ELSIF NOT EXISTS(SELECT 1 FROM dndshare.source_version v WHERE v.id=NEW.source_version_id AND v.source_id=NEW.system_id) THEN
  RAISE EXCEPTION 'Редакция не принадлежит системе сессии' USING ERRCODE='PRED1';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER session_edition_validation BEFORE INSERT OR UPDATE OF system_id,source_version_id ON dndshare."session" FOR EACH ROW EXECUTE FUNCTION dndshare.validate_session_edition();
