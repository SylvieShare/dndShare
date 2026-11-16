-- Scope legacy D&D relation rules to the D&D source, independent of type allocation.
CREATE OR REPLACE FUNCTION dndshare.normalize_origin_item_relation() RETURNS trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    relation_key text;
    reverse_key text;
    expected_parent_type int8;
    raw_parent jsonb;
    data_parent_id int8;
    actual_parent_type int8;
    actual_parent_user_id int8;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dndshare.item_type t JOIN dndshare.source s ON s.id=t.source_id WHERE t.id=NEW.type_id AND s.name='DND5e') THEN
        RETURN NEW;
    END IF;
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
$_$;

CREATE OR REPLACE FUNCTION dndshare.refresh_origin_reverse_relation(parent_item_id bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    parent_type int8;
    child_type int8;
    reverse_key text;
BEGIN
    SELECT item.type_id INTO parent_type
    FROM dndshare.item item
    JOIN dndshare.item_type t ON t.id=item.type_id
    JOIN dndshare.source s ON s.id=t.source_id AND s.name='DND5e'
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

CREATE OR REPLACE FUNCTION dndshare.sync_ability_type_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF pg_trigger_depth() = 1 AND EXISTS(SELECT 1 FROM dndshare.source WHERE id=NEW.source_id AND name='DND5e') THEN
        UPDATE dndshare.item_type SET fields = NEW.fields
        WHERE id IN (3, 4, 18) AND id <> NEW.id AND source_id=NEW.source_id
          AND fields IS DISTINCT FROM NEW.fields;
    END IF;
    RETURN NEW;
END;
$$;
