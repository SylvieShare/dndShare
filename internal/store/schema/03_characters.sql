
-- ---------------------------------------------------------------------------
-- Characters and templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dndshare.char_template (
    id                   bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
    "name"               varchar NOT NULL,
    CONSTRAINT char_template_pk PRIMARY KEY (id)
);

INSERT INTO dndshare.char_template ("name")
SELECT seed.name
FROM (VALUES ('DND5'), ('VTM20')) AS seed(name)
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare.char_template current
    WHERE upper(current.name) = upper(seed.name)
);

ALTER TABLE dndshare.char_template DROP COLUMN IF EXISTS "schema";
ALTER TABLE dndshare.char_template DROP COLUMN IF EXISTS create_form;
ALTER TABLE dndshare.char_template DROP COLUMN IF EXISTS path_values_for_list;
DROP TABLE IF EXISTS dndshare.template_block_type;

-- Half-casters start casting after level 1, so they intentionally have no
-- level-1 `spellcasting` grant. Their casting ability is still explicit data
-- used by later level-ups; application code must not infer it from a name.
UPDATE dndshare.item
SET data = jsonb_set(data, '{spellcasting_ability}', '6'::jsonb, true)
WHERE type_id = 9 AND lower(COALESCE(name_en, '')) = 'paladin'
  AND NOT data ? 'spellcasting_ability';
UPDATE dndshare.item
SET data = jsonb_set(data, '{spellcasting_ability}', '5'::jsonb, true)
WHERE type_id = 9 AND lower(COALESCE(name_en, '')) = 'ranger'
  AND NOT data ? 'spellcasting_ability';
UPDATE dndshare.item_type
SET fields = fields || '[{"name":"Характеристика заклинаний после 1 уровня","key":"spellcasting_ability","type":"suggest","suggest_id":16}]'::jsonb
WHERE id = 9
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(fields) field
    WHERE field ->> 'key' = 'spellcasting_ability'
  );

CREATE TABLE IF NOT EXISTS dndshare."char" (
    id             bigserial NOT NULL,
    "uuid"         uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id        int8 NOT NULL REFERENCES dndshare.users(id),
    template_id    int8 NOT NULL REFERENCES dndshare.char_template(id),
    source_version_id int8 NULL REFERENCES dndshare.source_version(id),
    "data"         jsonb NOT NULL,
    public_visible bool DEFAULT true NOT NULL,
    created_at     timestamptz DEFAULT now() NOT NULL,
    changed_at     timestamptz DEFAULT now() NOT NULL,
    "name"         varchar NULL,
    deleted        bool DEFAULT false NOT NULL,
    death          varchar DEFAULT 'false' NOT NULL,
    "version"      int8 DEFAULT 1 NOT NULL,
    icon_image_id   int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL,
    CONSTRAINT char_pk PRIMARY KEY (id),
    CONSTRAINT char_uuid_key UNIQUE (uuid)
);
ALTER TABLE dndshare."char"
    ADD COLUMN IF NOT EXISTS source_version_id int8 NULL REFERENCES dndshare.source_version(id);
ALTER TABLE dndshare."char"
    ADD COLUMN IF NOT EXISTS icon_image_id int8 NULL REFERENCES dndshare.storage_image(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_char_user_id ON dndshare."char" USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_char_user_changed ON dndshare."char" USING btree (user_id, changed_at DESC) WHERE (deleted = false);
CREATE INDEX IF NOT EXISTS idx_char_template_id ON dndshare."char" USING btree (template_id);
CREATE INDEX IF NOT EXISTS idx_char_source_version_id ON dndshare."char" USING btree (source_version_id);
CREATE INDEX IF NOT EXISTS idx_char_icon_image_id ON dndshare."char" USING btree (icon_image_id) WHERE icon_image_id IS NOT NULL;

-- Existing characters predate source_version_id. Backfill the two known
-- template families without touching already classified rows.
UPDATE dndshare."char" c
SET source_version_id = sv.id
FROM dndshare.char_template ct
JOIN dndshare."source" src ON (
    (upper(ct.name) IN ('DND5', 'DND5E') AND lower(src.name) = 'dnd5e')
    OR ((upper(ct.name) LIKE '%VTM%' OR upper(ct.name) LIKE '%VAMPIRE%') AND lower(src.name) = 'vampire: tm')
)
JOIN dndshare.source_version sv ON sv.source_id = src.id AND (
    (upper(ct.name) IN ('DND5', 'DND5E') AND sv.version = '2014')
    OR ((upper(ct.name) LIKE '%VTM%' OR upper(ct.name) LIKE '%VAMPIRE%') AND upper(sv.version) = 'V20')
)
WHERE c.template_id = ct.id AND c.source_version_id IS NULL;

CREATE OR REPLACE FUNCTION dndshare.canonicalize_dnd_character(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    values_data jsonb := COALESCE(document -> 'values', '{}'::jsonb);
    hp_data jsonb;
    items_data jsonb;
    spells_data jsonb;
    money_data jsonb;
    raw_amounts jsonb;
    amounts jsonb;
    coin jsonb;
    flat_items jsonb;
    level_data jsonb;
    item_ref jsonb;
    lookup_name text;
    ref_key text;
    ref_type int;
    stat_key text;
    score jsonb;
    die text;
    coin_key text;
    coin_alias text;
    amount_text text;
    total int;
    used int;
BEGIN
    FOREACH ref_key IN ARRAY ARRAY['race', 'subrace', 'class', 'subclass'] LOOP
        IF jsonb_typeof(values_data -> ref_key) = 'string' THEN
            lookup_name := btrim(values_data ->> ref_key);
            IF ref_key IN ('class', 'subclass') AND lower(lookup_name) = lower('Прохиндей') THEN
                lookup_name := 'Плут';
            END IF;
            ref_type := CASE WHEN ref_key IN ('race', 'subrace') THEN 8 ELSE 9 END;
            SELECT jsonb_build_object('id', i.id, 'name', i.name)
            INTO item_ref
            FROM dndshare.item i
            WHERE i.type_id = ref_type AND lower(i.name) = lower(lookup_name)
            ORDER BY (i.parent_id IS NULL) DESC, i.id
            LIMIT 1;
            IF item_ref IS NOT NULL THEN
                values_data := jsonb_set(values_data, ARRAY[ref_key], item_ref, true);
            END IF;
        END IF;
    END LOOP;

    level_data := values_data -> 'lvl';
    IF jsonb_typeof(level_data) IS DISTINCT FROM 'object' THEN
        values_data := jsonb_set(values_data, '{lvl}', jsonb_build_object(
            'level', CASE
                WHEN jsonb_typeof(level_data) = 'number' AND (level_data #>> '{}') ~ '^[0-9]+$'
                    THEN GREATEST(1, (level_data #>> '{}')::int)
                ELSE 1
            END,
            'exp', 0
        ), true);
    ELSE
        level_data := jsonb_set(level_data, '{level}', to_jsonb(CASE
            WHEN COALESCE(level_data ->> 'level', '') ~ '^[0-9]+$' THEN GREATEST(1, (level_data ->> 'level')::int)
            ELSE 1
        END), true);
        IF NOT level_data ? 'exp' THEN level_data := jsonb_set(level_data, '{exp}', '0'::jsonb, true); END IF;
        values_data := jsonb_set(values_data, '{lvl}', level_data, true);
    END IF;

    IF jsonb_typeof(values_data -> 'classes') IS DISTINCT FROM 'array'
       AND jsonb_typeof(values_data -> 'class') = 'object'
       AND (values_data -> 'class') ? 'id' THEN
        values_data := jsonb_set(values_data, '{classes}', jsonb_build_array(
            (values_data -> 'class')
            || jsonb_build_object('level', (values_data #>> '{lvl,level}')::int)
            || CASE
                WHEN jsonb_typeof(values_data -> 'subclass') = 'object' THEN jsonb_build_object('subclass', values_data -> 'subclass')
                ELSE '{}'::jsonb
               END
        ), true);
    END IF;
    values_data := values_data - 'class' - 'subclass';

    FOREACH stat_key IN ARRAY ARRAY['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'] LOOP
        IF jsonb_typeof(values_data -> stat_key) = 'number' THEN
            score := values_data -> stat_key;
            values_data := jsonb_set(values_data, ARRAY[stat_key], jsonb_build_object(
                'value', jsonb_build_object('base', score, 'bonuses', '[]'::jsonb)
            ), true);
        ELSIF jsonb_typeof(values_data #> ARRAY[stat_key, 'value']) = 'number' THEN
            score := values_data #> ARRAY[stat_key, 'value'];
            values_data := jsonb_set(values_data, ARRAY[stat_key, 'value'], jsonb_build_object(
                'base', score, 'bonuses', '[]'::jsonb
            ), true);
        END IF;
        IF jsonb_typeof(values_data -> stat_key) = 'object' THEN
            values_data := jsonb_set(
                values_data,
                ARRAY[stat_key],
                (values_data -> stat_key) - 'mod' - 'skills_up',
                true
            );
        END IF;
    END LOOP;

    IF jsonb_typeof(values_data -> 'initiative') = 'number' THEN
        values_data := jsonb_set(values_data, '{initiative}', jsonb_build_object(
            'base', values_data -> 'initiative', 'bonuses', '[]'::jsonb, 'use_dex', false
        ), true);
    END IF;
    IF jsonb_typeof(values_data -> 'exhaustion') = 'number' THEN
        values_data := jsonb_set(values_data, '{exhaustion}', jsonb_build_object('level', values_data -> 'exhaustion'), true);
    END IF;
    IF jsonb_typeof(values_data -> 'ava') = 'string' THEN
        values_data := jsonb_set(values_data, '{ava}', jsonb_build_object('url', values_data -> 'ava'), true);
    END IF;
    IF jsonb_typeof(values_data -> 'speed') = 'number' THEN
        values_data := jsonb_set(values_data, '{speed}', jsonb_build_object(
            'base', values_data -> 'speed', 'bonuses', '[]'::jsonb
        ), true);
    END IF;

    hp_data := CASE WHEN jsonb_typeof(values_data -> 'hp') = 'object' THEN values_data -> 'hp' ELSE '{}'::jsonb END;
    IF jsonb_typeof(hp_data -> 'hitDice') IS DISTINCT FROM 'array' OR jsonb_array_length(hp_data -> 'hitDice') = 0 THEN
        die := CASE WHEN COALESCE(hp_data ->> 'dice', '') ~ '^d[0-9]+$' THEN hp_data ->> 'dice' ELSE 'd8' END;
        total := CASE
            WHEN COALESCE(hp_data ->> 'diceCount', '') ~ '^[0-9]+$' THEN GREATEST(1, (hp_data ->> 'diceCount')::int)
            ELSE GREATEST(1, (values_data #>> '{lvl,level}')::int)
        END;
        used := CASE WHEN COALESCE(hp_data ->> 'diceUsed', '') ~ '^[0-9]+$' THEN LEAST(total, (hp_data ->> 'diceUsed')::int) ELSE 0 END;
        hp_data := jsonb_set(hp_data, '{hitDice}', jsonb_build_array(jsonb_build_object(
            'die', die, 'total', total, 'used', used
        )), true);
    END IF;
    hp_data := hp_data - 'dice' - 'diceCount' - 'diceUsed';
    values_data := jsonb_set(values_data, '{hp}', hp_data, true);

    spells_data := values_data -> 'spells';
    IF jsonb_typeof(spells_data) = 'array' THEN
        spells_data := jsonb_build_object(
            'stat_path', '', 'save_bonus', 0, 'attack_bonus', 0,
            'slots_rest', 'long_rest', 'preparation', false,
            'spells', spells_data, 'slots', '[]'::jsonb
        );
        values_data := jsonb_set(values_data, '{spells}', spells_data, true);
    ELSIF jsonb_typeof(spells_data) = 'object' THEN
        IF jsonb_typeof(spells_data -> 'spells') IS DISTINCT FROM 'array' THEN
            spells_data := jsonb_set(spells_data, '{spells}', '[]'::jsonb, true);
        END IF;
        IF jsonb_typeof(spells_data -> 'slots') IS DISTINCT FROM 'array' THEN
            spells_data := jsonb_set(spells_data, '{slots}', '[]'::jsonb, true);
        END IF;
        IF upper(regexp_replace(COALESCE(spells_data ->> 'stat_path', ''), '\.mod$', '', 'i')) IN ('STR','DEX','CON','INT','WIS','CHA') THEN
            spells_data := jsonb_set(spells_data, '{stat_path}', to_jsonb(CASE upper(regexp_replace(spells_data ->> 'stat_path', '\.mod$', '', 'i'))
                WHEN 'STR' THEN '1' WHEN 'DEX' THEN '2' WHEN 'CON' THEN '3'
                WHEN 'INT' THEN '4' WHEN 'WIS' THEN '5' WHEN 'CHA' THEN '6'
            END), true);
        END IF;
        values_data := jsonb_set(values_data, '{spells}', spells_data, true);
    END IF;

    money_data := values_data -> 'money';
    IF jsonb_typeof(money_data) IN ('array', 'object') THEN
        amounts := '{}'::jsonb;
        IF jsonb_typeof(money_data) = 'array' THEN
            FOR coin IN SELECT value FROM jsonb_array_elements(money_data) LOOP
                coin_key := lower(COALESCE(coin ->> 'id', ''));
                coin_key := CASE
                    WHEN coin_key = 'cp' OR lower(COALESCE(coin ->> 'title', '')) LIKE '%медн%' THEN '1'
                    WHEN coin_key = 'sp' OR lower(COALESCE(coin ->> 'title', '')) LIKE '%серебр%' THEN '2'
                    WHEN coin_key = 'gp' OR lower(COALESCE(coin ->> 'title', '')) LIKE '%золот%' THEN '3'
                    WHEN coin_key = 'ep' OR lower(COALESCE(coin ->> 'title', '')) LIKE '%электр%' THEN '4'
                    WHEN coin_key = 'pp' OR lower(COALESCE(coin ->> 'title', '')) LIKE '%платин%' THEN '5'
                    ELSE coin_key
                END;
                amount_text := COALESCE(coin ->> 'amount', '0');
                IF coin_key ~ '^[1-5]$' AND amount_text ~ '^[0-9]+$' THEN
                    amounts := jsonb_set(amounts, ARRAY[coin_key], to_jsonb(amount_text::int), true);
                END IF;
            END LOOP;
        ELSE
            raw_amounts := CASE
                WHEN jsonb_typeof(money_data -> 'amounts') = 'object' THEN money_data -> 'amounts'
                ELSE money_data
            END;
            FOREACH coin_key IN ARRAY ARRAY['1','2','3','4','5'] LOOP
                coin_alias := CASE coin_key WHEN '1' THEN 'cp' WHEN '2' THEN 'sp' WHEN '3' THEN 'gp' WHEN '4' THEN 'ep' ELSE 'pp' END;
                amount_text := COALESCE(raw_amounts ->> coin_key, raw_amounts ->> coin_alias, '0');
                IF amount_text ~ '^[0-9]+$' THEN
                    amounts := jsonb_set(amounts, ARRAY[coin_key], to_jsonb(amount_text::int), true);
                END IF;
            END LOOP;
        END IF;
        FOREACH coin_key IN ARRAY ARRAY['1','2','3','4','5'] LOOP
            IF NOT amounts ? coin_key THEN
                amounts := jsonb_set(amounts, ARRAY[coin_key], '0'::jsonb, true);
            END IF;
        END LOOP;
        values_data := jsonb_set(values_data, '{money}', jsonb_build_object(
            'order', jsonb_build_array(1,2,3,4,5), 'amounts', amounts
        ), true);
    END IF;

    IF jsonb_typeof(values_data -> 'items') = 'array' THEN
        items_data := values_data -> 'items';
        WITH RECURSIVE flat(entry) AS (
            SELECT value FROM jsonb_array_elements(items_data)
            UNION ALL
            SELECT nested.value
            FROM flat
            CROSS JOIN LATERAL jsonb_array_elements(CASE
                WHEN jsonb_typeof(flat.entry -> 'items') = 'array' THEN flat.entry -> 'items'
                ELSE '[]'::jsonb
            END) nested
        )
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'uid', COALESCE(entry ->> 'uid', 'migrated-' || md5(entry::text)),
            'id', COALESCE(entry -> 'id', 'null'::jsonb),
            'count', CASE WHEN COALESCE(entry ->> 'count', '') ~ '^[0-9]+$' THEN GREATEST(1, (entry ->> 'count')::int) ELSE 1 END,
            'override', CASE WHEN jsonb_typeof(entry -> 'override') = 'object' THEN entry -> 'override' ELSE 'null'::jsonb END
        )), '[]'::jsonb)
        INTO flat_items
        FROM flat
        WHERE entry ? 'id' OR jsonb_typeof(entry -> 'override') = 'object';
        items_data := jsonb_build_object(
            'equipped', '[]'::jsonb,
            'sections', jsonb_build_array(jsonb_build_object(
                'id', 'migrated-bag', 'name', 'Рюкзак', 'items', flat_items
            ))
        );
        values_data := jsonb_set(values_data, '{items}', items_data, true);
    ELSIF jsonb_typeof(values_data -> 'items') = 'object' THEN
        items_data := values_data -> 'items';
        IF jsonb_typeof(items_data -> 'equipped') IS DISTINCT FROM 'array' THEN items_data := jsonb_set(items_data, '{equipped}', '[]'::jsonb, true); END IF;
        IF jsonb_typeof(items_data -> 'sections') IS DISTINCT FROM 'array' THEN items_data := jsonb_set(items_data, '{sections}', '[]'::jsonb, true); END IF;
        SELECT COALESCE(jsonb_agg(section ORDER BY ord), '[]'::jsonb)
        INTO flat_items
        FROM jsonb_array_elements(items_data -> 'sections') WITH ORDINALITY rows(section, ord)
        WHERE section ->> 'id' <> 'equipped';
        SELECT COALESCE(jsonb_agg(entry ORDER BY section_ord, entry_ord), '[]'::jsonb)
        INTO raw_amounts
        FROM jsonb_array_elements(items_data -> 'sections') WITH ORDINALITY section_rows(section, section_ord)
        CROSS JOIN LATERAL jsonb_array_elements(CASE
            WHEN jsonb_typeof(section -> 'items') = 'array' THEN section -> 'items'
            ELSE '[]'::jsonb
        END) WITH ORDINALITY entry_rows(entry, entry_ord)
        WHERE section ->> 'id' = 'equipped';
        items_data := jsonb_set(items_data, '{equipped}', (items_data -> 'equipped') || raw_amounts, true);
        items_data := jsonb_set(items_data, '{sections}', flat_items, true);
        values_data := jsonb_set(values_data, '{items}', items_data, true);
    END IF;

    RETURN jsonb_set(document, '{values}', values_data, true);
END;
$$;

WITH normalized AS (
    SELECT c.id, dndshare.canonicalize_dnd_character(c.data) AS data
    FROM dndshare."char" c
    JOIN dndshare.char_template t ON t.id = c.template_id
    WHERE upper(t.name) IN ('DND5', 'DND5E')
)
UPDATE dndshare."char" c
SET data = normalized.data,
    version = c.version + 1,
    changed_at = now()
FROM normalized
WHERE c.id = normalized.id AND c.data IS DISTINCT FROM normalized.data;

DROP FUNCTION dndshare.canonicalize_dnd_character(jsonb);

-- Character-added weapon damage used a suggest-specific key even though the
-- value itself is the stable die id. Rename it recursively and end support for
-- the legacy payload shape.
CREATE OR REPLACE FUNCTION dndshare.systemize_character_dice(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    IF document IS NULL THEN RETURN NULL; END IF;
    CASE jsonb_typeof(document)
        WHEN 'array' THEN
            SELECT COALESCE(jsonb_agg(dndshare.systemize_character_dice(value) ORDER BY ord), '[]'::jsonb)
            INTO result
            FROM jsonb_array_elements(document) WITH ORDINALITY rows(value, ord);
        WHEN 'object' THEN
            SELECT COALESCE(jsonb_object_agg(key, dndshare.systemize_character_dice(value)), '{}'::jsonb)
            INTO result
            FROM jsonb_each(document);
            IF result ? 'dice_suggest_id' THEN
                IF NOT result ? 'dice_id' THEN
                    result := result || jsonb_build_object('dice_id', result -> 'dice_suggest_id');
                END IF;
                result := result - 'dice_suggest_id';
            END IF;
            IF result ->> 'dice_id' IN ('1','2','3','4','5','6','7') THEN
                result := jsonb_set(result, '{dice_id}', to_jsonb(CASE result ->> 'dice_id'
                    WHEN '1' THEN 'd4' WHEN '2' THEN 'd6' WHEN '3' THEN 'd8'
                    WHEN '4' THEN 'd10' WHEN '5' THEN 'd12' WHEN '6' THEN 'd20'
                    WHEN '7' THEN 'd100'
                END), false);
            END IF;
        ELSE result := document;
    END CASE;
    RETURN result;
END;
$$;

WITH normalized AS (
    SELECT c.id, dndshare.systemize_character_dice(c.data) AS data
    FROM dndshare."char" c
    JOIN dndshare.char_template t ON t.id = c.template_id
    WHERE upper(t.name) IN ('DND5', 'DND5E')
)
UPDATE dndshare."char" c
SET data = normalized.data,
    version = c.version + 1,
    changed_at = now()
FROM normalized
WHERE c.id = normalized.id AND c.data IS DISTINCT FROM normalized.data;

DROP FUNCTION dndshare.systemize_character_dice(jsonb);

-- Data correction: item 1421 was an old incomplete copy of the rogue class
-- feature Cunning Action, accidentally stored as a spell. Item 4056 is the
-- canonical PHB class feature. Redirect character JSON before deleting the
-- duplicate so existing sheets keep the ability and its usage state.
CREATE OR REPLACE FUNCTION dndshare.replace_item_id_in_jsonb(document jsonb, old_id int8, new_id int8)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    result jsonb;
BEGIN
    IF document IS NULL THEN
        RETURN NULL;
    END IF;
    CASE jsonb_typeof(document)
        WHEN 'object' THEN
            SELECT COALESCE(jsonb_object_agg(entry.key,
                CASE
                    WHEN entry.key = 'id' AND entry.value = to_jsonb(old_id) THEN to_jsonb(new_id)
                    ELSE dndshare.replace_item_id_in_jsonb(entry.value, old_id, new_id)
                END
            ), '{}'::jsonb)
            INTO result
            FROM jsonb_each(document) entry;
        WHEN 'array' THEN
            SELECT COALESCE(jsonb_agg(
                dndshare.replace_item_id_in_jsonb(entry.value, old_id, new_id)
                ORDER BY entry.ord
            ), '[]'::jsonb)
            INTO result
            FROM jsonb_array_elements(document) WITH ORDINALITY entry(value, ord);
        ELSE
            result := document;
    END CASE;
    RETURN result;
END;
$$;

UPDATE dndshare."char"
SET data = dndshare.replace_item_id_in_jsonb(data, 1421, 4056)
WHERE data::text LIKE '%1421%'
  AND EXISTS (SELECT 1 FROM dndshare.item WHERE id = 1421 AND type_id = 5 AND lower(name) = lower('Хитрое действие'))
  AND EXISTS (SELECT 1 FROM dndshare.item WHERE id = 4056 AND type_id = 4 AND lower(name) = lower('Хитрое действие'));

UPDATE dndshare.item
SET parent_id = 4056
WHERE parent_id = 1421
  AND EXISTS (SELECT 1 FROM dndshare.item WHERE id = 4056 AND type_id = 4 AND lower(name) = lower('Хитрое действие'));

UPDATE dndshare.item_version_compatibility
SET replaced_by_item_id = 4056
WHERE replaced_by_item_id = 1421
  AND EXISTS (SELECT 1 FROM dndshare.item WHERE id = 4056 AND type_id = 4 AND lower(name) = lower('Хитрое действие'));

DELETE FROM dndshare.item duplicate
WHERE duplicate.id = 1421
  AND duplicate.type_id = 5
  AND lower(duplicate.name) = lower('Хитрое действие')
  AND EXISTS (SELECT 1 FROM dndshare.item canonical WHERE canonical.id = 4056 AND canonical.type_id = 4 AND lower(canonical.name) = lower('Хитрое действие'));

DROP FUNCTION dndshare.replace_item_id_in_jsonb(jsonb, int8, int8);
