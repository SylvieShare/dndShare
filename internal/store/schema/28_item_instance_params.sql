-- Typed per-instance item parameters. Handbook rows describe the shared item;
-- owned/granted references carry concrete values such as rope length or a
-- weapon's magic bonus.

ALTER TABLE dndshare.item_type
    ADD COLUMN IF NOT EXISTS instance_fields jsonb DEFAULT '[]'::jsonb NOT NULL;

UPDATE dndshare.item_type
SET instance_fields = '[{"key":"magic_bonus","name":"Магический бонус","type":"int","min":0,"max":3,"default":0,"suffix":"+"}]'::jsonb
WHERE id = 1;

UPDATE dndshare.item_type
SET instance_fields = '[{"key":"length_ft","name":"Длина","type":"int","min":1,"default":50,"unit":"фт.","applies_when":{"item_data_key":"measurement","value":"length"},"unit_cost_data_key":"unit_cost_copper","unit_weight_data_key":"unit_weight"}]'::jsonb
WHERE id = 2;

-- Measurement is intrinsic metadata (the item is sold/owned by length), while
-- the concrete length remains on the reference. Keep the pack reference schema
-- canonical too, including an explicit params object.
UPDATE dndshare.item_type item_type
SET fields = COALESCE((
    SELECT jsonb_agg(field ORDER BY ordinal)
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY rows(field, ordinal)
    WHERE field ->> 'key' NOT IN ('measurement', 'unit_cost_copper', 'unit_weight', 'contents')
), '[]'::jsonb) || '[
  {"key":"measurement","name":"Способ измерения экземпляра","type":"select","options":[{"value":"length","label":"Длина"}]},
  {"key":"unit_cost_copper","name":"Стоимость единицы, мм","type":"int","show_on":{"key":"measurement","value":"length"}},
  {"key":"unit_weight","name":"Вес единицы, фнт.","type":"int","show_on":{"key":"measurement","value":"length"}},
  {"key":"contents","name":"Содержимое набора","type":"object_array","show_on":{"key":"equipment_category","value":"pack"},"fields":[{"key":"item_id","name":"Предмет","type":"item","item_type":2},{"key":"count","name":"Количество","type":"int","default":1},{"key":"params","name":"Параметры экземпляра","type":"object","fields":[{"key":"length_ft","name":"Длина, фт.","type":"int"}]}]}
]'::jsonb
WHERE item_type.id = 2;

-- Resolve both the imported names and the already-normalized names so the
-- migration is idempotent on every existing database.
UPDATE dndshare.item
SET name = CASE
        WHEN lower(name) IN (lower('Верёвка пеньковая (50 футов)'), lower('50-футовая пеньковая верёвка'))
            THEN 'Верёвка пеньковая'
        ELSE 'Верёвка шёлковая'
    END,
    name_en = CASE
        WHEN lower(name) IN (lower('Верёвка пеньковая (50 футов)'), lower('50-футовая пеньковая верёвка'), lower('Верёвка пеньковая'))
            THEN 'Rope, hempen'
        ELSE 'Rope, silk'
    END,
    data = (data - 'cost' - 'weight') || jsonb_build_object(
        'measurement', 'length',
        'unit_cost_copper', CASE
            WHEN lower(name) IN (lower('Верёвка пеньковая (50 футов)'), lower('50-футовая пеньковая верёвка'), lower('Верёвка пеньковая')) THEN 2
            ELSE 20
        END,
        'unit_weight', CASE
            WHEN lower(name) IN (lower('Верёвка пеньковая (50 футов)'), lower('50-футовая пеньковая верёвка'), lower('Верёвка пеньковая')) THEN 0.2
            ELSE 0.1
        END
    )
WHERE user_id IS NULL
  AND type_id = 2
  AND lower(name) IN (
      lower('Верёвка пеньковая (50 футов)'), lower('50-футовая пеньковая верёвка'), lower('Верёвка пеньковая'),
      lower('Верёвка шёлковая (50 футов)'), lower('Верёвка шёлковая')
  );

CREATE OR REPLACE FUNCTION dndshare.normalize_item_instance_links(rows jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(jsonb_agg(
        (entry - 'id' - 'item_id' - 'params') || jsonb_build_object(
            'item_id', COALESCE(entry -> 'item_id', entry -> 'id', 'null'::jsonb),
            'params',
            (CASE WHEN jsonb_typeof(entry -> 'params') = 'object' THEN entry -> 'params' ELSE '{}'::jsonb END)
            || CASE WHEN linked.data ->> 'measurement' = 'length'
                    THEN jsonb_build_object('length_ft', COALESCE(entry -> 'params' -> 'length_ft', '50'::jsonb))
                    ELSE '{}'::jsonb END
        ) ORDER BY ordinal
    ), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(rows) = 'array' THEN rows ELSE '[]'::jsonb END)
         WITH ORDINALITY source(entry, ordinal)
    LEFT JOIN dndshare.item linked ON linked.id = CASE
        WHEN COALESCE(entry ->> 'item_id', entry ->> 'id', '') ~ '^[0-9]+$'
            THEN COALESCE(entry ->> 'item_id', entry ->> 'id')::bigint
        ELSE NULL
    END;
$$;

UPDATE dndshare.item
SET data = jsonb_set(data, '{contents}', dndshare.normalize_item_instance_links(data -> 'contents'), true)
WHERE jsonb_typeof(data -> 'contents') = 'array';

UPDATE dndshare.item
SET data = jsonb_set(data, '{tool_items}', dndshare.normalize_item_instance_links(data -> 'tool_items'), true)
WHERE jsonb_typeof(data -> 'tool_items') = 'array';

UPDATE dndshare.item
SET data = jsonb_set(data, '{equipment_items}', dndshare.normalize_item_instance_links(data -> 'equipment_items'), true)
WHERE jsonb_typeof(data -> 'equipment_items') = 'array';

CREATE OR REPLACE FUNCTION dndshare.normalize_owned_item_entry(entry jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    linked_id jsonb := COALESCE(entry -> 'item_id', entry -> 'id', 'null'::jsonb);
    linked_data jsonb;
    params_data jsonb := CASE WHEN jsonb_typeof(entry -> 'params') = 'object' THEN entry -> 'params' ELSE '{}'::jsonb END;
BEGIN
    IF jsonb_typeof(linked_id) = 'number' THEN
        SELECT data INTO linked_data FROM dndshare.item WHERE id = (linked_id #>> '{}')::bigint;
    END IF;
    IF linked_data ->> 'measurement' = 'length' THEN
        params_data := params_data || jsonb_build_object('length_ft', COALESCE(params_data -> 'length_ft', '50'::jsonb));
    END IF;
    RETURN jsonb_build_object(
        'uid', COALESCE(entry -> 'uid', to_jsonb('migrated-' || md5(entry::text))),
        'item_id', linked_id,
        'count', CASE WHEN COALESCE(entry ->> 'count', '') ~ '^[0-9]+$' THEN GREATEST(1, (entry ->> 'count')::int) ELSE 1 END,
        'params', params_data,
        'override', CASE WHEN jsonb_typeof(entry -> 'override') = 'object' THEN entry -> 'override' ELSE 'null'::jsonb END
    );
END;
$$;

CREATE OR REPLACE FUNCTION dndshare.normalize_owned_item_array(rows jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE(jsonb_agg(dndshare.normalize_owned_item_entry(entry) ORDER BY ordinal), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(rows) = 'array' THEN rows ELSE '[]'::jsonb END)
         WITH ORDINALITY source(entry, ordinal);
$$;

CREATE OR REPLACE FUNCTION dndshare.normalize_inventory_instances(inventory jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
    SELECT jsonb_build_object(
        'equipped', dndshare.normalize_owned_item_array(inventory -> 'equipped'),
        'sections', COALESCE((
            SELECT jsonb_agg(
                (section - 'items') || jsonb_build_object('items', dndshare.normalize_owned_item_array(section -> 'items'))
                ORDER BY ordinal
            )
            FROM jsonb_array_elements(CASE WHEN jsonb_typeof(inventory -> 'sections') = 'array'
                THEN inventory -> 'sections' ELSE '[]'::jsonb END) WITH ORDINALITY source(section, ordinal)
        ), '[]'::jsonb)
    );
$$;

CREATE OR REPLACE FUNCTION dndshare.normalize_weapon_instances(rows jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'item_id', COALESCE(entry -> 'item_id', 'null'::jsonb),
        'params', (CASE WHEN jsonb_typeof(entry -> 'params') = 'object' THEN entry -> 'params' ELSE '{}'::jsonb END)
            || jsonb_build_object('magic_bonus', COALESCE(entry -> 'params' -> 'magic_bonus', entry -> 'magic_up', '0'::jsonb)),
        'stat_suggest_id', COALESCE(entry -> 'stat_suggest_id', 'null'::jsonb),
        'proficient', COALESCE(entry -> 'proficient', 'false'::jsonb),
        'add_attacks', CASE WHEN jsonb_typeof(entry -> 'add_attacks') = 'array' THEN entry -> 'add_attacks' ELSE '[]'::jsonb END,
        'desc', COALESCE(entry -> 'desc', '""'::jsonb)
    ) ORDER BY ordinal), '[]'::jsonb)
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(rows) = 'array' THEN rows ELSE '[]'::jsonb END)
         WITH ORDINALITY source(entry, ordinal);
$$;

UPDATE dndshare."char"
SET data = jsonb_set(data, '{values,items}', dndshare.normalize_inventory_instances(data #> '{values,items}'), true)
WHERE jsonb_typeof(data #> '{values,items}') = 'object';

UPDATE dndshare."char"
SET data = jsonb_set(data, '{values,potions}', dndshare.normalize_owned_item_array(data #> '{values,potions}'), true)
WHERE jsonb_typeof(data #> '{values,potions}') = 'array';

UPDATE dndshare."char"
SET data = jsonb_set(data, '{values,weapon}', dndshare.normalize_weapon_instances(data #> '{values,weapon}'), true)
WHERE jsonb_typeof(data #> '{values,weapon}') = 'array';

DROP FUNCTION dndshare.normalize_weapon_instances(jsonb);
DROP FUNCTION dndshare.normalize_inventory_instances(jsonb);
DROP FUNCTION dndshare.normalize_owned_item_array(jsonb);
DROP FUNCTION dndshare.normalize_owned_item_entry(jsonb);
DROP FUNCTION dndshare.normalize_item_instance_links(jsonb);
