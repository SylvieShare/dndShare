-- Structural baseline exported from PostgreSQL 18.6 on 2026-10-17.
-- Definitions only; no catalogue seeds or data conversions.

CREATE FUNCTION dndshare.classify_content_source_kind(raw_code text) RETURNS character varying
    LANGUAGE sql IMMUTABLE
    AS $$
    SELECT CASE
        WHEN upper(btrim(COALESCE(raw_code, ''))) IN ('PHB', 'MM', 'DMG')
            THEN 'core'
        WHEN upper(btrim(COALESCE(raw_code, ''))) LIKE 'UA%'
            THEN 'playtest'
        WHEN upper(btrim(COALESCE(raw_code, ''))) IN (
            'AATM', 'BOTJR', 'COA', 'CON', 'DMF5E', 'DODK', 'GHTPG', 'LH', 'LHEX',
            'MHH', 'ODL', 'OOW', 'PG', 'TDCS', 'TLTRW', 'TP', 'VSOS'
        ) THEN 'third_party'
        WHEN upper(btrim(COALESCE(raw_code, ''))) IN (
            'AAG', 'AI', 'EGTW', 'ERLW', 'GGR', 'MOT', 'SATO', 'SCAG', 'SCC', 'VRGR'
        ) THEN 'setting'
        WHEN upper(btrim(COALESCE(raw_code, ''))) IN (
            'BGDIA', 'CM', 'COS', 'CRCOTN', 'DIP', 'DITLCOT', 'DOSI', 'DSOTDQ',
            'GOS', 'HFTT', 'HOTDQ', 'IDROTF', 'JTTRC', 'KFTGV', 'KKW', 'LLK',
            'LMOP', 'LOX', 'OOTA', 'PABTSO', 'POTA', 'QFTIS', 'ROT', 'SKT',
            'TOA', 'TOFW', 'VEOR', 'WBTW', 'WDH', 'WDMM'
        ) THEN 'adventure'
        ELSE 'supplement'
    END
$$;

CREATE FUNCTION dndshare.create_default_custom_item_source() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO dndshare.custom_item_source (user_id, "name", is_default)
    VALUES (NEW.id, 'Мои материалы', true)
    ON CONFLICT (user_id) WHERE is_default DO NOTHING;
    RETURN NEW;
END;
$$;

CREATE FUNCTION dndshare.normalize_origin_item_relation() RETURNS trigger
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

CREATE FUNCTION dndshare.refresh_origin_reverse_relation(parent_item_id bigint) RETURNS void
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

CREATE FUNCTION dndshare.sync_ability_type_fields() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF pg_trigger_depth() = 1 THEN
        UPDATE dndshare.item_type SET fields = NEW.fields
        WHERE id IN (3, 4, 18) AND id <> NEW.id
          AND fields IS DISTINCT FROM NEW.fields;
    END IF;
    RETURN NEW;
END;
$$;

CREATE FUNCTION dndshare.sync_origin_reverse_relation() RETURNS trigger
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
