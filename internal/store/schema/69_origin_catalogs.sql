-- Races/classes and their variants are separate handbook collections. The
-- generic item.parent_id edge remains the normalized relation, while item data
-- exposes both directions for schema-driven clients:
--   race.data.subraces[] <-> subrace.data.race
--   class.data.subclasses[] <-> subclass.data.class

WITH race_type AS (
    SELECT * FROM dndshare.item_type WHERE id = 8
)
INSERT INTO dndshare.item_type (
    id, name, parent_type_id, fields, instance_fields, source_id,
    icon_image_id, cover_image_id, color, important, description
)
SELECT 16,
       'Подрасы',
       8,
       jsonb_build_array(jsonb_build_object(
           'name', 'Раса',
           'key', 'race',
           'type', 'item',
           'item_type', 8,
           'required', true,
           'filter', true,
           'filter_item_type', 8
       )) || COALESCE((
           SELECT jsonb_agg(field ORDER BY ordinal)
           FROM jsonb_array_elements(COALESCE(race_type.fields, '[]'::jsonb))
                WITH ORDINALITY inherited(field, ordinal)
           WHERE field ->> 'key' NOT IN ('race', 'subraces')
       ), '[]'::jsonb),
       COALESCE(race_type.instance_fields, '[]'::jsonb),
       race_type.source_id,
       race_type.icon_image_id,
       race_type.cover_image_id,
       '#48a985',
       true,
       'Наследия и варианты рас: связь с базовой расой, особые бонусы, владения и способности.'
FROM race_type
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    parent_type_id = EXCLUDED.parent_type_id,
    fields = EXCLUDED.fields,
    instance_fields = EXCLUDED.instance_fields,
    source_id = EXCLUDED.source_id,
    icon_image_id = COALESCE(dndshare.item_type.icon_image_id, EXCLUDED.icon_image_id),
    cover_image_id = COALESCE(dndshare.item_type.cover_image_id, EXCLUDED.cover_image_id),
    color = EXCLUDED.color,
    important = EXCLUDED.important,
    description = EXCLUDED.description;

WITH class_type AS (
    SELECT * FROM dndshare.item_type WHERE id = 9
)
INSERT INTO dndshare.item_type (
    id, name, parent_type_id, fields, instance_fields, source_id,
    icon_image_id, cover_image_id, color, important, description
)
SELECT 17,
       'Подклассы',
       9,
       jsonb_build_array(jsonb_build_object(
           'name', 'Класс',
           'key', 'class',
           'type', 'item',
           'item_type', 9,
           'required', true,
           'filter', true,
           'filter_item_type', 9
       )) || COALESCE((
           SELECT jsonb_agg(field ORDER BY ordinal)
           FROM jsonb_array_elements(COALESCE(class_type.fields, '[]'::jsonb))
                WITH ORDINALITY inherited(field, ordinal)
           WHERE field ->> 'key' NOT IN ('class', 'subclasses')
       ), '[]'::jsonb),
       COALESCE(class_type.instance_fields, '[]'::jsonb),
       class_type.source_id,
       class_type.icon_image_id,
       class_type.cover_image_id,
       '#9a70df',
       true,
       'Архетипы классов: связь с базовым классом, особые владения, заклинательство и способности.'
FROM class_type
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    parent_type_id = EXCLUDED.parent_type_id,
    fields = EXCLUDED.fields,
    instance_fields = EXCLUDED.instance_fields,
    source_id = EXCLUDED.source_id,
    icon_image_id = COALESCE(dndshare.item_type.icon_image_id, EXCLUDED.icon_image_id),
    cover_image_id = COALESCE(dndshare.item_type.cover_image_id, EXCLUDED.cover_image_id),
    color = EXCLUDED.color,
    important = EXCLUDED.important,
    description = EXCLUDED.description;

-- Base collections expose their reverse relation as read-only schema data.
UPDATE dndshare.item_type item_type
SET name = 'Расы',
    description = 'Базовые расы персонажей: размер, скорость, языки, владения и связанные подрасы.',
    fields = COALESCE((
        SELECT jsonb_agg(field ORDER BY ordinal)
        FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
             WITH ORDINALITY current(field, ordinal)
        WHERE field ->> 'key' <> 'subraces'
    ), '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'name', 'Подрасы',
        'key', 'subraces',
        'type', 'object_array',
        'readonly', true,
        'fields', jsonb_build_array(jsonb_build_object(
            'name', 'Подраса', 'key', 'id', 'type', 'item', 'item_type', 16
        ))
    ))
WHERE item_type.id = 8;

UPDATE dndshare.item_type item_type
SET name = 'Классы',
    description = 'Базовые классы персонажей: кость хитов, ключевые характеристики, владения, заклинательство и связанные подклассы.',
    fields = COALESCE((
        SELECT jsonb_agg(field ORDER BY ordinal)
        FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
             WITH ORDINALITY current(field, ordinal)
        WHERE field ->> 'key' <> 'subclasses'
    ), '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'name', 'Подклассы',
        'key', 'subclasses',
        'type', 'object_array',
        'readonly', true,
        'fields', jsonb_build_array(jsonb_build_object(
            'name', 'Подкласс', 'key', 'id', 'type', 'item', 'item_type', 17
        ))
    ))
WHERE item_type.id = 9;

-- Feature ownership keeps the existing keys, but their referenced item types
-- now reflect the dedicated catalogues.
UPDATE dndshare.item_type item_type
SET fields = (
    SELECT jsonb_agg(
        CASE WHEN field ->> 'key' = 'subrace_ids'
            THEN jsonb_set(
                field || jsonb_build_object(
                    'filter', true,
                    'filter_path', 'subrace_ids.id',
                    'filter_item_type', 16
                ),
                '{fields}',
                COALESCE((
                    SELECT jsonb_agg(
                        CASE WHEN nested ->> 'key' = 'id'
                            THEN jsonb_set(nested, '{item_type}', '16'::jsonb, true)
                            ELSE nested END
                        ORDER BY nested_ordinal
                    )
                    FROM jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb))
                         WITH ORDINALITY nested_fields(nested, nested_ordinal)
                ), '[]'::jsonb),
                true
            )
            ELSE field END
        ORDER BY ordinal
    )
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
         WITH ORDINALITY fields(field, ordinal)
)
WHERE item_type.id = 3;

UPDATE dndshare.item_type item_type
SET fields = (
    SELECT jsonb_agg(
        CASE WHEN field ->> 'key' = 'subclass_ids'
            THEN jsonb_set(
                field || jsonb_build_object(
                    'filter', true,
                    'filter_path', 'subclass_ids.id',
                    'filter_item_type', 17
                ),
                '{fields}',
                COALESCE((
                    SELECT jsonb_agg(
                        CASE WHEN nested ->> 'key' = 'id'
                            THEN jsonb_set(nested, '{item_type}', '17'::jsonb, true)
                            ELSE nested END
                        ORDER BY nested_ordinal
                    )
                    FROM jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb))
                         WITH ORDINALITY nested_fields(nested, nested_ordinal)
                ), '[]'::jsonb),
                true
            )
            ELSE field END
        ORDER BY ordinal
    )
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
         WITH ORDINALITY fields(field, ordinal)
)
WHERE item_type.id = 4;

-- Preserve item ids, media, publication links and every character reference;
-- only the concrete catalogue discriminator changes.
UPDATE dndshare.item SET type_id = 16 WHERE type_id = 8 AND parent_id IS NOT NULL;
UPDATE dndshare.item SET type_id = 17 WHERE type_id = 9 AND parent_id IS NOT NULL;

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{race}', to_jsonb(parent_id), true)
WHERE type_id = 16 AND parent_id IS NOT NULL;

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{class}', to_jsonb(parent_id), true)
WHERE type_id = 17 AND parent_id IS NOT NULL;

UPDATE dndshare.item race
SET data = jsonb_set(
    COALESCE(race.data, '{}'::jsonb),
    '{subraces}',
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', child.id) ORDER BY child.name, child.id)
        FROM dndshare.item child
        WHERE child.type_id = 16 AND child.parent_id = race.id
          AND child.user_id IS NOT DISTINCT FROM race.user_id
    ), '[]'::jsonb),
    true
)
WHERE race.type_id = 8;

UPDATE dndshare.item class_item
SET data = jsonb_set(
    COALESCE(class_item.data, '{}'::jsonb),
    '{subclasses}',
    COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', child.id) ORDER BY child.name, child.id)
        FROM dndshare.item child
        WHERE child.type_id = 17 AND child.parent_id = class_item.id
          AND child.user_id IS NOT DISTINCT FROM class_item.user_id
    ), '[]'::jsonb),
    true
)
WHERE class_item.type_id = 9;

-- Keep both JSON directions synchronized for HTTP, MCP and FK-driven changes.
CREATE OR REPLACE FUNCTION dndshare.normalize_origin_item_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    relation_key text;
    reverse_key text;
    expected_parent_type int8;
    raw_parent jsonb;
    data_parent_id int8;
    actual_parent_type int8;
    actual_parent_user_id int8;
BEGIN
    IF NEW.type_id = 16 THEN
        relation_key := 'race';
        expected_parent_type := 8;
    ELSIF NEW.type_id = 17 THEN
        relation_key := 'class';
        expected_parent_type := 9;
    ELSIF NEW.type_id = 8 OR NEW.type_id = 9 THEN
        reverse_key := CASE WHEN NEW.type_id = 8 THEN 'subraces' ELSE 'subclasses' END;
        NEW.parent_id := NULL;
        NEW.data := jsonb_set(
            COALESCE(NEW.data, '{}'::jsonb),
            ARRAY[reverse_key],
            COALESCE((
                SELECT jsonb_agg(jsonb_build_object('id', child.id) ORDER BY child.name, child.id)
                FROM dndshare.item child
                WHERE child.parent_id = NEW.id
                  AND child.type_id = CASE WHEN NEW.type_id = 8 THEN 16 ELSE 17 END
                  AND child.user_id IS NOT DISTINCT FROM NEW.user_id
            ), '[]'::jsonb),
            true
        );
        RETURN NEW;
    ELSE
        RETURN NEW;
    END IF;

    raw_parent := COALESCE(NEW.data, '{}'::jsonb) -> relation_key;
    IF jsonb_typeof(raw_parent) = 'number' AND (raw_parent #>> '{}') ~ '^[0-9]+$' THEN
        data_parent_id := (raw_parent #>> '{}')::int8;
    ELSIF jsonb_typeof(raw_parent) = 'object' AND COALESCE(raw_parent ->> 'id', '') ~ '^[0-9]+$' THEN
        data_parent_id := (raw_parent ->> 'id')::int8;
    END IF;

    IF TG_OP = 'INSERT' THEN
        NEW.parent_id := COALESCE(NEW.parent_id, data_parent_id);
    ELSIF NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id
       AND raw_parent IS DISTINCT FROM COALESCE(OLD.data, '{}'::jsonb) -> relation_key THEN
        NEW.parent_id := data_parent_id;
    END IF;

    IF NEW.parent_id IS NULL THEN
        RAISE EXCEPTION '% item % must reference a base item', relation_key, NEW.id;
    END IF;

    SELECT item.type_id, item.user_id INTO actual_parent_type, actual_parent_user_id
    FROM dndshare.item item
    WHERE item.id = NEW.parent_id;
    IF actual_parent_type IS DISTINCT FROM expected_parent_type THEN
        RAISE EXCEPTION '% item % must reference parent type %, got %',
            relation_key, NEW.id, expected_parent_type, actual_parent_type;
    END IF;
    IF actual_parent_user_id IS NOT NULL
       AND actual_parent_user_id IS DISTINCT FROM NEW.user_id THEN
        RAISE EXCEPTION '% item % cannot reference a private parent owned by another user',
            relation_key, NEW.id;
    END IF;

    NEW.data := jsonb_set(
        COALESCE(NEW.data, '{}'::jsonb),
        ARRAY[relation_key],
        to_jsonb(NEW.parent_id),
        true
    );
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION dndshare.refresh_origin_reverse_relation(parent_item_id int8)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    parent_type int8;
    child_type int8;
    reverse_key text;
BEGIN
    SELECT item.type_id INTO parent_type
    FROM dndshare.item item
    WHERE item.id = parent_item_id;

    IF parent_type = 8 THEN
        child_type := 16;
        reverse_key := 'subraces';
    ELSIF parent_type = 9 THEN
        child_type := 17;
        reverse_key := 'subclasses';
    ELSE
        RETURN;
    END IF;

    UPDATE dndshare.item parent
    SET data = jsonb_set(
        COALESCE(parent.data, '{}'::jsonb),
        ARRAY[reverse_key],
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('id', child.id) ORDER BY child.name, child.id)
            FROM dndshare.item child
            WHERE child.type_id = child_type AND child.parent_id = parent_item_id
              AND child.user_id IS NOT DISTINCT FROM parent.user_id
        ), '[]'::jsonb),
        true
    )
    WHERE parent.id = parent_item_id;
END;
$$;

CREATE OR REPLACE FUNCTION dndshare.sync_origin_reverse_relation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP <> 'INSERT' AND OLD.type_id IN (16, 17) AND OLD.parent_id IS NOT NULL THEN
        PERFORM dndshare.refresh_origin_reverse_relation(OLD.parent_id);
    END IF;
    IF TG_OP <> 'DELETE' AND NEW.type_id IN (16, 17) AND NEW.parent_id IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.parent_id IS DISTINCT FROM OLD.parent_id OR NEW.type_id IS DISTINCT FROM OLD.type_id) THEN
        PERFORM dndshare.refresh_origin_reverse_relation(NEW.parent_id);
    END IF;
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS item_normalize_origin_relation ON dndshare.item;
CREATE TRIGGER item_normalize_origin_relation
BEFORE INSERT OR UPDATE OF type_id, parent_id, data, user_id ON dndshare.item
FOR EACH ROW EXECUTE FUNCTION dndshare.normalize_origin_item_relation();

DROP TRIGGER IF EXISTS item_sync_origin_reverse_relation ON dndshare.item;
CREATE TRIGGER item_sync_origin_reverse_relation
AFTER INSERT OR UPDATE OF type_id, parent_id, data, user_id, name OR DELETE ON dndshare.item
FOR EACH ROW EXECUTE FUNCTION dndshare.sync_origin_reverse_relation();

UPDATE dndshare.item_type item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id IN (8, 9, 16, 17);

SELECT setval(
    pg_get_serial_sequence('dndshare.item_type', 'id'),
    GREATEST(COALESCE((SELECT MAX(id) FROM dndshare.item_type), 17), 17),
    true
);
