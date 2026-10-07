-- Logical element identity is independent from the shared family/group code.
CREATE FUNCTION dndshare.map_model_group_code(pack text,original_name text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
    SELECT (CASE pack WHEN 'ultimate-dungeon' THEN 'UD' WHEN 'lost-cave' THEN 'LC'
        WHEN 'toxic-sewer' THEN 'TS' WHEN 'majestic-highlands' THEN 'MH'
        WHEN 'basic-elements' THEN 'BE' WHEN 'map-objects' THEN 'MA'
        ELSE upper(left(regexp_replace(pack,'[^a-zA-Z]','','g'),3)) END)||'-'||
        trim(both '-' FROM regexp_replace(lower(regexp_replace(regexp_replace(regexp_replace(
            original_name,'[[:space:]]+[0-9]+([xX][0-9]+)?$','','g'),
            '[[:space:]]+(Open|Closed|Lit|Extinguished|Empty|Full)$','','i'),
            '^Ground Symbol.*$','Ground Symbol','i')),'[^a-z0-9]+','-','g'))
$$;
ALTER TABLE dndshare.map_model_definition ADD COLUMN code varchar(160);
UPDATE dndshare.map_model_definition SET code=dndshare.map_model_group_code(collection,source_name);

-- Transition components share the code of their first named variant.
WITH RECURSIVE edges AS (
    SELECT from_model_id AS a,to_model_id AS b FROM dndshare.map_model_transition
    UNION SELECT to_model_id,from_model_id FROM dndshare.map_model_transition
), reachable AS (
    SELECT id AS start,id AS member FROM dndshare.map_model_definition
    UNION SELECT r.start,e.b FROM reachable r JOIN edges e ON e.a=r.member
), roots AS (
    SELECT start,min(member) AS first FROM reachable GROUP BY start
)
UPDATE dndshare.map_model_definition d SET code=base.code
FROM roots r JOIN dndshare.map_model_definition base ON base.id=r.first WHERE d.id=r.start;
ALTER TABLE dndshare.map_model_definition ALTER COLUMN code SET NOT NULL;
ALTER TABLE dndshare.map_model_definition ADD CONSTRAINT map_model_group_code_valid
    CHECK(code ~ '^[A-Z]{2,3}-[a-z0-9]+(-[a-z0-9]+)*$' AND length(code)<=160);
CREATE INDEX map_model_definition_group ON dndshare.map_model_definition(collection,code);

CREATE FUNCTION dndshare.default_map_model_group_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.code IS NULL THEN NEW.code=dndshare.map_model_group_code(NEW.collection,NEW.source_name); END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER map_model_group_default BEFORE INSERT ON dndshare.map_model_definition
FOR EACH ROW EXECUTE FUNCTION dndshare.default_map_model_group_code();
