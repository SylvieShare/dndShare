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
      {"key":"required_tool_proficiencies","name":"Требуемые владения","type":"suggest_array","suggest_id":5,"match":"any","filter":true},
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

-- Physical tools live in the generic inventory. Return entries created by the
-- short-lived dedicated tools block to the first inventory section once;
-- proficiencies remain independent in values.proficiencies."Инструменты".
CREATE OR REPLACE FUNCTION dndshare.move_tools_collection_to_inventory(document jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    values_data jsonb := CASE WHEN jsonb_typeof(document -> 'values') = 'object'
        THEN document -> 'values' ELSE '{}'::jsonb END;
    tools jsonb;
    inventory jsonb;
    sections jsonb;
    first_section jsonb;
    first_items jsonb;
BEGIN
    IF jsonb_typeof(values_data -> 'tools') IS DISTINCT FROM 'array' THEN
        RETURN document;
    END IF;

    tools := values_data -> 'tools';
    values_data := values_data - 'tools';

    IF jsonb_array_length(tools) > 0 THEN
        inventory := CASE WHEN jsonb_typeof(values_data -> 'items') = 'object'
            THEN values_data -> 'items' ELSE '{}'::jsonb END;
        sections := CASE WHEN jsonb_typeof(inventory -> 'sections') = 'array'
            THEN inventory -> 'sections' ELSE '[]'::jsonb END;

        IF jsonb_array_length(sections) = 0 THEN
            sections := jsonb_build_array(jsonb_build_object(
                'id', 'bag',
                'name', 'Рюкзак',
                'items', tools
            ));
        ELSE
            first_section := CASE WHEN jsonb_typeof(sections -> 0) = 'object'
                THEN sections -> 0 ELSE jsonb_build_object('id', 'bag', 'name', 'Рюкзак') END;
            first_items := CASE WHEN jsonb_typeof(first_section -> 'items') = 'array'
                THEN first_section -> 'items' ELSE '[]'::jsonb END;
            first_section := (first_section - 'items')
                || jsonb_build_object('items', first_items || tools);
            sections := jsonb_set(sections, '{0}', first_section, true);
        END IF;

        inventory := jsonb_set(inventory, '{sections}', sections, true);
        values_data := jsonb_set(values_data, '{items}', inventory, true);
    END IF;

    RETURN jsonb_set(document, '{values}', values_data, true);
END;
$$;

WITH migrated AS (
    SELECT character.id, dndshare.move_tools_collection_to_inventory(character.data) AS data
    FROM dndshare."char" character
)
UPDATE dndshare."char" character
SET data = migrated.data,
    version = character.version + 1,
    changed_at = now()
FROM migrated
WHERE character.id = migrated.id
  AND character.data IS DISTINCT FROM migrated.data;

DROP FUNCTION dndshare.move_tools_collection_to_inventory(jsonb);

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
