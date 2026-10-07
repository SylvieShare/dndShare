CREATE TABLE dndshare.map_model_definition (
    id varchar(512) PRIMARY KEY,
    collection varchar(80) NOT NULL,
    source_code varchar(80) NOT NULL,
    source_name varchar(255) NOT NULL,
    revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
    default_lights jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(default_lights)='array'),
    UNIQUE(collection,source_code,source_name)
);
INSERT INTO dndshare.map_model_definition(id,collection,source_code,source_name)
SELECT source_code||CASE WHEN row_number() OVER(PARTITION BY source_code ORDER BY collection,source_name)=1 THEN ''
    ELSE '-'||trim(both '-' FROM regexp_replace(lower(source_name),'[^a-z0-9]+','-','g'))||'-'||substr(md5(collection||':'||source_name),1,6) END,
    collection,source_code,source_name
FROM (SELECT DISTINCT collection,source_code,source_name FROM dndshare.map_model) variants;
ALTER TABLE dndshare.map_model ADD COLUMN definition_id varchar(512) REFERENCES dndshare.map_model_definition(id);
UPDATE dndshare.map_model m SET definition_id=d.id FROM dndshare.map_model_definition d
WHERE (m.collection,m.source_code,m.source_name)=(d.collection,d.source_code,d.source_name);
ALTER TABLE dndshare.map_model ALTER COLUMN definition_id SET NOT NULL;
CREATE INDEX map_model_definition_versions ON dndshare.map_model(definition_id,version DESC);

-- Every importer and revision writer shares the same logical identity.
CREATE FUNCTION dndshare.assign_map_model_definition() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER map_model_definition_identity BEFORE INSERT OR UPDATE OF collection,source_code,source_name,definition_id
ON dndshare.map_model FOR EACH ROW EXECUTE FUNCTION dndshare.assign_map_model_definition();

CREATE TABLE dndshare.map_model_transition (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    from_model_id varchar(512) NOT NULL REFERENCES dndshare.map_model_definition(id),
    to_model_id varchar(512) NOT NULL REFERENCES dndshare.map_model_definition(id),
    action varchar(24) NOT NULL CHECK(action IN ('open','close','extinguish','ignite','empty','fill')),
    CHECK(from_model_id<>to_model_id),
    UNIQUE(from_model_id,to_model_id,action)
);

INSERT INTO dndshare.map_model_transition(from_model_id,to_model_id,action)
SELECT a.id,b.id,p.action FROM (VALUES
    ('UD-010','UD-010-OPEN','open'), ('UD-010-OPEN','UD-010','close'),
    ('UD-015','UD-077','fill'), ('UD-077','UD-015','empty'),
    ('UD-031','UD-032','empty'), ('UD-032','UD-031','fill'),
    ('UD-037','UD-038','extinguish'), ('UD-038','UD-037','ignite')
) p(source,target,action)
JOIN dndshare.map_model_definition a ON a.collection='ultimate-dungeon' AND a.source_code=p.source
JOIN dndshare.map_model_definition b ON b.collection=a.collection AND b.source_code=p.target;

-- Local footprint X/Y; height above the body datum (mounting peg excluded).
UPDATE dndshare.map_model_definition SET default_lights='[{
    "key":"flame","name":"Факел","kind":"torch","color":"#ffc36a",
    "position":[0.5,0.7,1.12],"intensity":8,"radius":4.5,
    "enabled":true,"flicker":true
}]'::jsonb WHERE collection='ultimate-dungeon' AND source_code='UD-037';
