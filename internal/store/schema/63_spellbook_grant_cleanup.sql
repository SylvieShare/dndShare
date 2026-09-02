-- Migration 61 was already applied while another deployment was running.
-- Keep its checksum immutable and correct two legacy edge cases separately:
-- old `source: feat` rows are grants only, and legacy class-grant labels use
-- the effective subclass when one exists.

CREATE OR REPLACE FUNCTION dndshare.cleanup_spellbook_grants_v2(book jsonb, character_values jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    tabs_out jsonb := '[]'::jsonb;
    grants_out jsonb := '[]'::jsonb;
    grants jsonb := CASE WHEN jsonb_typeof(book -> 'grants') = 'array' THEN book -> 'grants' ELSE '[]'::jsonb END;
    classes jsonb := CASE WHEN jsonb_typeof(character_values -> 'classes') = 'array'
        THEN character_values -> 'classes' ELSE '[]'::jsonb END;
    tab_row jsonb;
    grant_row jsonb;
    cleaned_spells jsonb;
    class_entry jsonb;
    source_id bigint;
    source_name text;
BEGIN
    IF COALESCE((book ->> 'schema_version')::int, 0) <> 2 THEN RETURN book; END IF;

    FOR tab_row IN
        SELECT value FROM jsonb_array_elements(CASE WHEN jsonb_typeof(book -> 'tabs') = 'array'
            THEN book -> 'tabs' ELSE '[]'::jsonb END)
    LOOP
        SELECT COALESCE(jsonb_agg(spell ORDER BY ord), '[]'::jsonb)
        INTO cleaned_spells
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(tab_row -> 'spells') = 'array'
            THEN tab_row -> 'spells' ELSE '[]'::jsonb END) WITH ORDINALITY AS rows(spell, ord)
        WHERE NOT (
            COALESCE(spell ->> 'key', '') ~ '^legacy:.*:spell:[0-9]+$'
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(grants) legacy_grant
                WHERE legacy_grant #>> '{source,kind}' = 'feat'
                  AND legacy_grant ->> 'key' = 'legacy:grant:'
                    || substring(spell ->> 'key' FROM 'spell:([0-9]+)$') || ':1'
            )
        );
        tabs_out := tabs_out || jsonb_build_array(jsonb_set(tab_row, '{spells}', cleaned_spells, true));
    END LOOP;

    FOR grant_row IN SELECT value FROM jsonb_array_elements(grants) LOOP
        IF COALESCE(grant_row ->> 'key', '') LIKE 'legacy:grant:%'
            AND grant_row #>> '{source,kind}' = 'class' THEN
            source_id := CASE WHEN COALESCE(grant_row #>> '{source,item_id}', '') ~ '^[0-9]+$'
                THEN (grant_row #>> '{source,item_id}')::bigint ELSE NULL END;
            SELECT value INTO class_entry
            FROM jsonb_array_elements(classes)
            WHERE COALESCE(value ->> 'id', '') = COALESCE(source_id::text, '')
            LIMIT 1;
            IF COALESCE(class_entry #>> '{subclass,id}', '') ~ '^[0-9]+$' THEN
                source_id := (class_entry #>> '{subclass,id}')::bigint;
            END IF;
            SELECT item.name INTO source_name FROM dndshare.item item WHERE item.id = source_id;
            grant_row := jsonb_set(
                grant_row,
                '{source}',
                COALESCE(grant_row -> 'source', '{}'::jsonb) || jsonb_build_object(
                    'item_id', source_id,
                    'label', COALESCE(source_name, grant_row #>> '{source,label}', 'Класс')
                ),
                true
            );
        END IF;
        grants_out := grants_out || jsonb_build_array(grant_row);
    END LOOP;

    RETURN jsonb_set(jsonb_set(book, '{tabs}', tabs_out, true), '{grants}', grants_out, true);
END;
$$;

UPDATE dndshare."char" character
SET data = jsonb_set(
    character.data,
    '{values,spells}',
    dndshare.cleanup_spellbook_grants_v2(character.data #> '{values,spells}', character.data -> 'values'),
    true
)
WHERE COALESCE((character.data #>> '{values,spells,schema_version}')::int, 0) = 2;

DROP FUNCTION dndshare.cleanup_spellbook_grants_v2(jsonb, jsonb);
