-- Replace the transitional shared spell list/source-settings shape with one
-- canonical spellbook. Runtime code intentionally has no fallback for the old
-- fields after this one-time data migration.

CREATE OR REPLACE FUNCTION dndshare.migrate_spellbook_tabs_v2(book jsonb, character_values jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    old_spells jsonb := CASE
        WHEN jsonb_typeof(book) = 'array' THEN book
        WHEN jsonb_typeof(book -> 'spells') = 'array' THEN book -> 'spells'
        ELSE '[]'::jsonb
    END;
    settings jsonb := CASE WHEN jsonb_typeof(book -> 'source_settings') = 'object'
        THEN book -> 'source_settings' ELSE '{}'::jsonb END;
    classes jsonb := CASE WHEN jsonb_typeof(character_values -> 'classes') = 'array'
        THEN character_values -> 'classes' ELSE '[]'::jsonb END;
    tabs jsonb := '[]'::jsonb;
    grants jsonb := '[]'::jsonb;
    long_slots jsonb := '[]'::jsonb;
    short_slots jsonb := '[]'::jsonb;
    tab_spells jsonb;
    class_entry jsonb;
    class_item jsonb;
    subclass_item jsonb;
    effective_item jsonb;
    setting jsonb;
    spell_row jsonb;
    source_row jsonb;
    sources jsonb;
    class_id bigint;
    subclass_id bigint;
    class_count int := jsonb_array_length(classes);
    spell_ord bigint;
    source_ord bigint;
    source_key text;
    tab_key text;
    tab_name text;
    mode text;
    ability_value jsonb;
    has_owned boolean;
    has_global_config boolean;
    pool_rest text;
BEGIN
    IF jsonb_typeof(book) = 'object' AND COALESCE((book ->> 'schema_version')::int, 0) = 2 THEN
        RETURN book;
    END IF;

    IF jsonb_typeof(book -> 'slot_pools') = 'object' THEN
        long_slots := CASE WHEN jsonb_typeof(book #> '{slot_pools,long_rest}') = 'array'
            THEN book #> '{slot_pools,long_rest}' ELSE '[]'::jsonb END;
        short_slots := CASE WHEN jsonb_typeof(book #> '{slot_pools,short_rest}') = 'array'
            THEN book #> '{slot_pools,short_rest}' ELSE '[]'::jsonb END;
    ELSE
        pool_rest := CASE WHEN book ->> 'slots_rest' = 'short_rest' THEN 'short_rest' ELSE 'long_rest' END;
        IF jsonb_typeof(book -> 'slots') = 'array' THEN
            SELECT COALESCE(jsonb_agg(slot ORDER BY ord), '[]'::jsonb)
            INTO tab_spells
            FROM jsonb_array_elements(book -> 'slots') WITH ORDINALITY AS rows(slot, ord)
            WHERE COALESCE((slot ->> 'total')::int, 0) > 0;
            IF pool_rest = 'short_rest' THEN short_slots := tab_spells; ELSE long_slots := tab_spells; END IF;
        END IF;
        IF jsonb_typeof(book -> 'pact_slots') = 'object'
            AND COALESCE((book #>> '{pact_slots,total}')::int, 0) > 0 THEN
            short_slots := short_slots || jsonb_build_array(book -> 'pact_slots');
        END IF;
    END IF;

    has_global_config := COALESCE(book ->> 'stat_path', '') <> ''
        OR COALESCE((book ->> 'preparation')::boolean, false)
        OR jsonb_array_length(long_slots) > 0
        OR jsonb_array_length(short_slots) > 0;

    FOR class_entry IN SELECT value FROM jsonb_array_elements(classes) LOOP
        IF COALESCE(class_entry ->> 'id', '') !~ '^[0-9]+$' THEN CONTINUE; END IF;
        class_id := (class_entry ->> 'id')::bigint;
        subclass_id := CASE WHEN COALESCE(class_entry #>> '{subclass,id}', '') ~ '^[0-9]+$'
            THEN (class_entry #>> '{subclass,id}')::bigint ELSE NULL END;
        source_key := 'class:' || class_id || ':' || COALESCE(subclass_id::text, '');
        tab_key := 'class:' || class_id;

        SELECT value INTO setting
        FROM jsonb_each(settings)
        WHERE key = source_key OR split_part(key, ':', 2) = class_id::text
        ORDER BY (key = source_key) DESC
        LIMIT 1;

        SELECT to_jsonb(item) INTO class_item FROM dndshare.item item WHERE item.id = class_id;
        SELECT to_jsonb(item) INTO subclass_item FROM dndshare.item item WHERE item.id = subclass_id;
        effective_item := CASE
            WHEN jsonb_typeof(subclass_item #> '{data,spellcasting}') = 'object' THEN subclass_item
            ELSE class_item
        END;

        SELECT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(old_spells) spell
            WHERE NOT COALESCE((spell ->> 'external_only')::boolean, false)
              AND NOT COALESCE((spell ->> 'always_prepared')::boolean, false)
              AND NOT spell ? 'source'
              AND (
                split_part(COALESCE(spell ->> 'spellcasting_source', ''), ':', 2) = class_id::text
                OR (COALESCE(spell ->> 'spellcasting_source', '') = '' AND class_count = 1)
              )
        ) INTO has_owned;

        IF jsonb_typeof(setting) IS DISTINCT FROM 'object'
            AND NOT has_owned
            AND NOT (class_count = 1 AND has_global_config AND jsonb_typeof(effective_item #> '{data,spellcasting}') = 'object') THEN
            CONTINUE;
        END IF;

        mode := COALESCE(effective_item #>> '{data,spellcasting,selection_mode}',
            CASE WHEN COALESCE((setting ->> 'preparation')::boolean, COALESCE((book ->> 'preparation')::boolean, false))
                THEN 'prepared' ELSE 'known' END);
        IF mode NOT IN ('known', 'prepared', 'spellbook') THEN mode := 'known'; END IF;
        ability_value := COALESCE(setting -> 'stat_path', book -> 'stat_path',
            effective_item #> '{data,spellcasting,ability}', effective_item #> '{data,spellcasting_ability}', '""'::jsonb);
        tab_name := COALESCE(class_item ->> 'name', class_entry ->> 'name', 'Магия');

        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'key', 'legacy:' || tab_key || ':spell:' || ord,
            'id', (spell ->> 'id')::bigint,
            'prepared', CASE WHEN mode = 'known' THEN false ELSE COALESCE((spell ->> 'prepared')::boolean, false) END
        ) ORDER BY ord), '[]'::jsonb)
        INTO tab_spells
        FROM jsonb_array_elements(old_spells) WITH ORDINALITY AS rows(spell, ord)
        WHERE COALESCE(spell ->> 'id', '') ~ '^[0-9]+$'
          AND NOT COALESCE((spell ->> 'external_only')::boolean, false)
          AND NOT COALESCE((spell ->> 'always_prepared')::boolean, false)
          AND NOT spell ? 'source'
          AND (
            split_part(COALESCE(spell ->> 'spellcasting_source', ''), ':', 2) = class_id::text
            OR (COALESCE(spell ->> 'spellcasting_source', '') = '' AND class_count = 1)
          );

        tabs := tabs || jsonb_build_array(jsonb_build_object(
            'key', tab_key,
            'name', tab_name,
            'class_item_id', class_id,
            'casting_ability', ability_value,
            'mode', mode,
            'save_bonus', COALESCE((setting ->> 'save_bonus')::numeric, (book ->> 'save_bonus')::numeric, 0),
            'attack_bonus', COALESCE((setting ->> 'attack_bonus')::numeric, (book ->> 'attack_bonus')::numeric, 0),
            'spells', tab_spells
        ));
    END LOOP;

    -- Any owned spell that cannot be assigned unambiguously remains editable in
    -- an explicit custom tab instead of being copied into every class.
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'key', 'legacy:unassigned:spell:' || ord,
        'id', (spell ->> 'id')::bigint,
        'prepared', COALESCE((spell ->> 'prepared')::boolean, false)
    ) ORDER BY ord), '[]'::jsonb)
    INTO tab_spells
    FROM jsonb_array_elements(old_spells) WITH ORDINALITY AS rows(spell, ord)
    WHERE COALESCE(spell ->> 'id', '') ~ '^[0-9]+$'
      AND NOT COALESCE((spell ->> 'external_only')::boolean, false)
      AND NOT COALESCE((spell ->> 'always_prepared')::boolean, false)
      AND NOT spell ? 'source'
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(classes) class_row
        WHERE COALESCE(class_row ->> 'id', '') = split_part(COALESCE(spell ->> 'spellcasting_source', ''), ':', 2)
           OR (COALESCE(spell ->> 'spellcasting_source', '') = '' AND class_count = 1)
      );
    IF jsonb_array_length(tab_spells) > 0 THEN
        tabs := tabs || jsonb_build_array(jsonb_build_object(
            'key', 'custom:unassigned', 'name', 'Без источника', 'class_item_id', NULL,
            'casting_ability', COALESCE(book -> 'stat_path', '""'::jsonb),
            'mode', CASE WHEN COALESCE((book ->> 'preparation')::boolean, false) THEN 'prepared' ELSE 'known' END,
            'save_bonus', COALESCE((book ->> 'save_bonus')::numeric, 0),
            'attack_bonus', COALESCE((book ->> 'attack_bonus')::numeric, 0),
            'spells', tab_spells
        ));
    END IF;

    FOR spell_row, spell_ord IN
        SELECT spell, ord FROM jsonb_array_elements(old_spells) WITH ORDINALITY AS rows(spell, ord)
        WHERE COALESCE(spell ->> 'id', '') ~ '^[0-9]+$'
    LOOP
        sources := CASE WHEN jsonb_typeof(spell_row -> 'granted_by') = 'array'
            AND jsonb_array_length(spell_row -> 'granted_by') > 0
            THEN spell_row -> 'granted_by' ELSE '[]'::jsonb END;
        IF jsonb_array_length(sources) = 0 AND (
            spell_row ? 'source'
            OR COALESCE((spell_row ->> 'external_only')::boolean, false)
            OR COALESCE((spell_row ->> 'always_prepared')::boolean, false)
        ) THEN
            source_row := CASE
                WHEN jsonb_typeof(spell_row -> 'source') = 'object' THEN spell_row -> 'source'
                WHEN spell_row ->> 'source' = 'feat' THEN jsonb_build_object('kind', 'feat', 'label', 'Черта')
                WHEN split_part(COALESCE(spell_row ->> 'spellcasting_source', ''), ':', 1) = 'class'
                    THEN jsonb_build_object(
                        'kind', 'class',
                        'item_id', COALESCE(
                            NULLIF(split_part(spell_row ->> 'spellcasting_source', ':', 3), '')::bigint,
                            NULLIF(split_part(spell_row ->> 'spellcasting_source', ':', 2), '')::bigint
                        ),
                        'label', COALESCE((
                            SELECT item.name FROM dndshare.item item
                            WHERE item.id = COALESCE(
                                NULLIF(split_part(spell_row ->> 'spellcasting_source', ':', 3), '')::bigint,
                                NULLIF(split_part(spell_row ->> 'spellcasting_source', ':', 2), '')::bigint
                            )
                        ), 'Класс')
                    )
                ELSE jsonb_build_object('kind', 'legacy', 'label', 'Даровано особенностью')
            END;
            sources := jsonb_build_array(source_row);
        END IF;

        FOR source_row, source_ord IN
            SELECT source, ord FROM jsonb_array_elements(sources) WITH ORDINALITY AS source_rows(source, ord)
        LOOP
            tab_key := CASE
                WHEN split_part(COALESCE(spell_row ->> 'spellcasting_source', ''), ':', 2) ~ '^[0-9]+$'
                    THEN 'class:' || split_part(spell_row ->> 'spellcasting_source', ':', 2)
                ELSE NULL
            END;
            grants := grants || jsonb_build_array(
                jsonb_strip_nulls(jsonb_build_object(
                    'key', 'legacy:grant:' || spell_ord || ':' || source_ord,
                    'id', (spell_row ->> 'id')::bigint,
                    'source', source_row,
                    'tab_key', tab_key,
                    'casting_ability', COALESCE(spell_row -> 'casting_ability', source_row -> 'casting_ability'),
                    'cast_level', COALESCE(spell_row -> 'cast_level', source_row -> 'cast_level'),
                    'slotless', CASE WHEN COALESCE((spell_row ->> 'slotless')::boolean, false) THEN true ELSE NULL END,
                    'counts_as_known', CASE WHEN COALESCE((spell_row ->> 'counts_as_known')::boolean, false) THEN true ELSE NULL END
                ))
            );
        END LOOP;
    END LOOP;

    RETURN jsonb_build_object(
        'schema_version', 2,
        'slots_auto', COALESCE((book ->> 'slots_auto')::boolean, true),
        'slot_pools', jsonb_build_object('long_rest', long_slots, 'short_rest', short_slots),
        'tabs', tabs,
        'grants', grants
    );
END;
$$;

UPDATE dndshare."char" character
SET data = jsonb_set(
    character.data,
    '{values,spells}',
    dndshare.migrate_spellbook_tabs_v2(character.data #> '{values,spells}', character.data -> 'values'),
    true
)
WHERE jsonb_typeof(character.data #> '{values,spells}') IN ('object', 'array')
  AND COALESCE((character.data #>> '{values,spells,schema_version}')::int, 0) <> 2;

DROP FUNCTION dndshare.migrate_spellbook_tabs_v2(jsonb, jsonb);
