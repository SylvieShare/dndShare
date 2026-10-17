-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE FUNCTION dndshare.set_default_user_source_version() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.source_version_id IS NULL THEN
        SELECT sv.id INTO NEW.source_version_id
        FROM dndshare.source_version sv
        JOIN dndshare."source" src ON src.id = sv.source_id
        WHERE lower(src.name) = lower('DND5e') AND sv.version = '2014'
        ORDER BY sv.id
        LIMIT 1;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION dndshare.validate_session_edition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
 IF NEW.system_id IS NULL THEN NEW.source_version_id := NULL;
 ELSIF NEW.source_version_id IS NULL THEN
  SELECT v.id INTO NEW.source_version_id FROM dndshare.source_version v WHERE v.source_id=NEW.system_id ORDER BY (v.version='2014') DESC,v.id LIMIT 1;
 ELSIF NOT EXISTS(SELECT 1 FROM dndshare.source_version v WHERE v.id=NEW.source_version_id AND v.source_id=NEW.system_id) THEN
  RAISE EXCEPTION 'Редакция не принадлежит системе сессии' USING ERRCODE='PRED1';
 END IF;
 RETURN NEW;
END $$;
