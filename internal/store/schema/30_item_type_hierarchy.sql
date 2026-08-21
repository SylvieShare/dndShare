-- Handbook collection hierarchy and dedicated tool catalogue. An item keeps one
-- concrete type; parent_type_id describes where specialized collections can be
-- consumed together (for example by the character inventory picker).

ALTER TABLE dndshare.item_type
    ADD COLUMN IF NOT EXISTS parent_type_id int8 NULL REFERENCES dndshare.item_type(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_item_type_parent_type_id
    ON dndshare.item_type USING btree (parent_type_id);

INSERT INTO dndshare.item_type (
    id, name, parent_type_id, fields, instance_fields, source_id,
    icon_image_id, color, important, description
)
VALUES (
    14,
    'Инструменты',
    2,
    '[
      {"key":"desc","name":"Описание","type":"description"},
      {"key":"category","name":"Категория инструмента","type":"select","filter":true,"options":[{"value":"artisan","label":"Ремесленные инструменты"},{"value":"gaming","label":"Игровые наборы"},{"value":"musical","label":"Музыкальные инструменты"},{"value":"kit","label":"Прочие наборы"}]},
      {"key":"cost","name":"Стоимость","type":"int_by_suggest","suggest_type_id":17},
      {"key":"weight","name":"Вес","type":"int"},
      {"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}
    ]'::jsonb,
    '[]'::jsonb,
    (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1),
    (SELECT icon_image_id FROM dndshare.item_type WHERE id = 2),
    '#a97852',
    false,
    'Ремесленные инструменты, игровые наборы, музыкальные инструменты и специальные комплекты.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    parent_type_id = EXCLUDED.parent_type_id,
    fields = EXCLUDED.fields,
    instance_fields = EXCLUDED.instance_fields,
    source_id = EXCLUDED.source_id,
    icon_image_id = COALESCE(dndshare.item_type.icon_image_id, EXCLUDED.icon_image_id),
    color = EXCLUDED.color,
    description = EXCLUDED.description;

-- Weapons, potions, armor, transport and tools are specialized collections of
-- Things. Their ids stay stable, so existing item and character references do
-- not require aliases.
UPDATE dndshare.item_type
SET parent_type_id = 2
WHERE id IN (1, 10, 12, 13, 14)
  AND parent_type_id IS DISTINCT FROM 2;
UPDATE dndshare.item_type SET parent_type_id = NULL WHERE id = 2;

-- Move every old tool record, including user-created ones and background
-- placeholders, into the dedicated collection without changing item ids.
UPDATE dndshare.item item
SET type_id = 14,
    data = (item.data - 'equipment_category') || jsonb_build_object(
        'category', CASE
            WHEN lower(COALESCE(item.name_en, '')) IN (
                'dragonchess set', 'playing card set', 'dice set', 'three-dragon ante set',
                'background gaming set choice'
            ) THEN 'gaming'
            WHEN lower(COALESCE(item.name_en, '')) IN (
                'drum', 'viol', 'bagpipes', 'lyre', 'lute', 'horn', 'pan flute',
                'flute', 'dulcimer', 'shawm', 'background musical instrument choice'
            ) THEN 'musical'
            WHEN lower(COALESCE(item.name_en, '')) LIKE '%supplies'
              OR lower(COALESCE(item.name_en, '')) IN (
                  'tinker''s tools', 'mason''s tools', 'cartographer''s tools',
                  'leatherworker''s tools', 'smith''s tools', 'carpenter''s tools',
                  'woodcarver''s tools', 'cobbler''s tools', 'jeweler''s tools'
              )
              OR lower(COALESCE(item.name_en, '')) = 'background artisan tools choice'
            THEN 'artisan'
            ELSE 'kit'
        END
    )
WHERE item.type_id = 2
  AND item.data ->> 'equipment_category' = 'tool';

-- Earlier startup sections still recognize type-14 rows while resolving PHB
-- grants and may temporarily restore the old discriminator. The final current
-- shape never exposes it.
UPDATE dndshare.item
SET data = data - 'equipment_category'
WHERE type_id = 14
  AND data ? 'equipment_category';

-- The generic Things schema no longer exposes the obsolete tool discriminator.
UPDATE dndshare.item_type item_type
SET fields = COALESCE((
    SELECT jsonb_agg(
        CASE
            WHEN field ->> 'key' = 'equipment_category' THEN
                jsonb_set(
                    field,
                    '{options}',
                    COALESCE((
                        SELECT jsonb_agg(option_value ORDER BY option_ordinal)
                        FROM jsonb_array_elements(COALESCE(field -> 'options', '[]'::jsonb))
                            WITH ORDINALITY options(option_value, option_ordinal)
                        WHERE option_value ->> 'value' <> 'tool'
                    ), '[]'::jsonb),
                    true
                )
            ELSE field
        END
        ORDER BY ordinal
    )
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
        WITH ORDINALITY fields(field, ordinal)
), '[]'::jsonb)
WHERE item_type.id = 2;

-- Existing sheets used the generic inventory for owned tools. Move those
-- entries to values.tools once; proficiencies remain the independent source of
-- truth in values.proficiencies."Инструменты".
CREATE OR REPLACE FUNCTION dndshare.move_inventory_tools_to_collection(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    values_data jsonb := CASE WHEN jsonb_typeof(document -> 'values') = 'object'
        THEN document -> 'values' ELSE '{}'::jsonb END;
    inventory jsonb := values_data -> 'items';
    tools jsonb := CASE WHEN jsonb_typeof(values_data -> 'tools') = 'array'
        THEN values_data -> 'tools' ELSE '[]'::jsonb END;
    moved jsonb := '[]'::jsonb;
    equipped jsonb;
    sections jsonb;
BEGIN
    IF jsonb_typeof(inventory) IS DISTINCT FROM 'object' THEN
        RETURN document;
    END IF;

    SELECT COALESCE(jsonb_agg(entry ORDER BY source_order, entry_order), '[]'::jsonb)
    INTO moved
    FROM (
        SELECT entry, 0::bigint AS source_order, entry_order
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(inventory -> 'equipped') = 'array'
            THEN inventory -> 'equipped' ELSE '[]'::jsonb END)
            WITH ORDINALITY equipped_rows(entry, entry_order)
        UNION ALL
        SELECT entry, section_order, entry_order
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(inventory -> 'sections') = 'array'
            THEN inventory -> 'sections' ELSE '[]'::jsonb END)
            WITH ORDINALITY section_rows(section, section_order)
        CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(section -> 'items') = 'array'
            THEN section -> 'items' ELSE '[]'::jsonb END)
            WITH ORDINALITY item_rows(entry, entry_order)
    ) owned
    JOIN dndshare.item linked ON linked.id = CASE
        WHEN COALESCE(owned.entry ->> 'item_id', '') ~ '^[0-9]+$'
            THEN (owned.entry ->> 'item_id')::bigint
        ELSE NULL
    END
    WHERE linked.type_id = 14;

    IF jsonb_array_length(moved) = 0 THEN
        RETURN document;
    END IF;

    SELECT COALESCE(jsonb_agg(entry ORDER BY entry_order), '[]'::jsonb)
    INTO equipped
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(inventory -> 'equipped') = 'array'
        THEN inventory -> 'equipped' ELSE '[]'::jsonb END)
        WITH ORDINALITY equipped_rows(entry, entry_order)
    LEFT JOIN dndshare.item linked ON linked.id = CASE
        WHEN COALESCE(entry ->> 'item_id', '') ~ '^[0-9]+$' THEN (entry ->> 'item_id')::bigint
        ELSE NULL
    END
    WHERE linked.type_id IS DISTINCT FROM 14;

    SELECT COALESCE(jsonb_agg(
        (section - 'items') || jsonb_build_object('items', COALESCE(filtered.items, '[]'::jsonb))
        ORDER BY section_order
    ), '[]'::jsonb)
    INTO sections
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(inventory -> 'sections') = 'array'
        THEN inventory -> 'sections' ELSE '[]'::jsonb END)
        WITH ORDINALITY section_rows(section, section_order)
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(entry ORDER BY entry_order) AS items
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(section -> 'items') = 'array'
            THEN section -> 'items' ELSE '[]'::jsonb END)
            WITH ORDINALITY item_rows(entry, entry_order)
        LEFT JOIN dndshare.item linked ON linked.id = CASE
            WHEN COALESCE(entry ->> 'item_id', '') ~ '^[0-9]+$' THEN (entry ->> 'item_id')::bigint
            ELSE NULL
        END
        WHERE linked.type_id IS DISTINCT FROM 14
    ) filtered ON true;

    inventory := jsonb_set(inventory, '{equipped}', equipped, true);
    inventory := jsonb_set(inventory, '{sections}', sections, true);
    values_data := jsonb_set(values_data, '{items}', inventory, true);
    values_data := jsonb_set(values_data, '{tools}', tools || moved, true);
    RETURN jsonb_set(document, '{values}', values_data, true);
END;
$$;

WITH migrated AS (
    SELECT character.id, dndshare.move_inventory_tools_to_collection(character.data) AS data
    FROM dndshare."char" character
)
UPDATE dndshare."char" character
SET data = migrated.data,
    version = character.version + 1,
    changed_at = now()
FROM migrated
WHERE character.id = migrated.id
  AND character.data IS DISTINCT FROM migrated.data;

DROP FUNCTION dndshare.move_inventory_tools_to_collection(jsonb);

UPDATE dndshare.item_type item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id IN (1, 2, 10, 12, 13, 14);

SELECT setval(
    pg_get_serial_sequence('dndshare.item_type', 'id'),
    GREATEST((SELECT MAX(id) FROM dndshare.item_type), 1)
);
