-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE FUNCTION dndshare.assign_map_model_definition() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE logical_id text;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended('map-model-code:'||NEW.source_code,0));
    SELECT id INTO logical_id FROM dndshare.map_model_definition
        WHERE (collection,source_code,source_name)=(NEW.collection,NEW.source_code,NEW.source_name);
    IF logical_id IS NULL THEN
        logical_id=NEW.source_code;
        IF EXISTS(SELECT 1 FROM dndshare.map_model_definition WHERE id=logical_id) THEN
            logical_id=logical_id||'-'||trim(both '-' FROM regexp_replace(lower(NEW.source_name),'[^a-z0-9]+','-','g'))||'-'||substr(md5(NEW.collection||':'||NEW.source_name),1,6);
        END IF;
    END IF;
    INSERT INTO dndshare.map_model_definition(id,collection,source_code,source_name)
    VALUES(logical_id,NEW.collection,NEW.source_code,NEW.source_name)
    ON CONFLICT(collection,source_code,source_name) DO UPDATE SET collection=EXCLUDED.collection
    RETURNING id INTO logical_id;
    IF NEW.definition_id IS NOT NULL AND NEW.definition_id<>logical_id THEN
        RAISE EXCEPTION 'model definition does not match source identity';
    END IF;
    NEW.definition_id=logical_id;
    RETURN NEW;
END;
$$;

CREATE FUNCTION dndshare.default_map_model_group_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.code IS NULL THEN NEW.code=dndshare.map_model_group_code(NEW.collection,NEW.source_name); END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION dndshare.map_model_group_code(pack text, original_name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
    SELECT (CASE pack WHEN 'ultimate-dungeon' THEN 'UD' WHEN 'lost-cave' THEN 'LC'
        WHEN 'toxic-sewer' THEN 'TS' WHEN 'majestic-highlands' THEN 'MH'
        WHEN 'basic-elements' THEN 'BE' WHEN 'map-objects' THEN 'MA'
        ELSE upper(left(regexp_replace(pack,'[^a-zA-Z]','','g'),3)) END)||'-'||
        trim(both '-' FROM regexp_replace(lower(regexp_replace(regexp_replace(regexp_replace(
            original_name,'[[:space:]]+[0-9]+([xX][0-9]+)?$','','g'),
            '[[:space:]]+(Open|Closed|Lit|Extinguished|Empty|Full)$','','i'),
            '^Ground Symbol.*$','Ground Symbol','i')),'[^a-z0-9]+','-','g'))
$_$;
