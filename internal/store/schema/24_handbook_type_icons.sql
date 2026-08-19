-- Built-in collection emblems live in the embedded frontend and are projected
-- through storage_image so item_type follows the same raster-media contract as
-- handbook items. The stable type ids are application data for D&D 5e.
CREATE UNIQUE INDEX IF NOT EXISTS storage_image_system_item_type_icon_key
    ON dndshare.storage_image ("key")
    WHERE user_id IS NULL AND "type" = 'item_type_icon' AND "key" IS NOT NULL;

WITH icon_seed(type_id, object_key, image_url, file_name, file_size) AS (
    VALUES
        (1::bigint,  'static-handbook-type-icons/v1/1-weapons.png',          '/static/handbook-types/1-weapons.png',          '1-weapons.png',          71773::bigint),
        (2::bigint,  'static-handbook-type-icons/v1/2-items.png',            '/static/handbook-types/2-items.png',            '2-items.png',            77276::bigint),
        (3::bigint,  'static-handbook-type-icons/v1/3-racial-abilities.png', '/static/handbook-types/3-racial-abilities.png', '3-racial-abilities.png', 66569::bigint),
        (4::bigint,  'static-handbook-type-icons/v1/4-class-abilities.png',  '/static/handbook-types/4-class-abilities.png',  '4-class-abilities.png',  72614::bigint),
        (5::bigint,  'static-handbook-type-icons/v1/5-spells.png',           '/static/handbook-types/5-spells.png',           '5-spells.png',           60665::bigint),
        (6::bigint,  'static-handbook-type-icons/v1/6-bestiary.png',         '/static/handbook-types/6-bestiary.png',         '6-bestiary.png',         84661::bigint),
        (7::bigint,  'static-handbook-type-icons/v1/7-feats.png',            '/static/handbook-types/7-feats.png',            '7-feats.png',            56436::bigint),
        (8::bigint,  'static-handbook-type-icons/v1/8-races.png',            '/static/handbook-types/8-races.png',            '8-races.png',            67024::bigint),
        (9::bigint,  'static-handbook-type-icons/v1/9-classes.png',          '/static/handbook-types/9-classes.png',          '9-classes.png',          66411::bigint),
        (10::bigint, 'static-handbook-type-icons/v1/10-potions.png',         '/static/handbook-types/10-potions.png',         '10-potions.png',         60306::bigint),
        (11::bigint, 'static-handbook-type-icons/v1/11-backgrounds.png',     '/static/handbook-types/11-backgrounds.png',     '11-backgrounds.png',     77917::bigint),
        (12::bigint, 'static-handbook-type-icons/v1/12-armor.png',           '/static/handbook-types/12-armor.png',           '12-armor.png',           71924::bigint),
        (13::bigint, 'static-handbook-type-icons/v1/13-transport.png',       '/static/handbook-types/13-transport.png',       '13-transport.png',       93538::bigint)
), inserted AS (
    INSERT INTO dndshare.storage_image (
        user_id, "key", url, "type", deleted, file_name, mime_type, file_size
    )
    SELECT NULL, seed.object_key, seed.image_url, 'item_type_icon', false,
           seed.file_name, 'image/png', seed.file_size
    FROM icon_seed seed
    ON CONFLICT ("key") WHERE user_id IS NULL AND "type" = 'item_type_icon' AND "key" IS NOT NULL
    DO UPDATE SET
        url = EXCLUDED.url,
        deleted = false,
        file_name = EXCLUDED.file_name,
        mime_type = EXCLUDED.mime_type,
        file_size = EXCLUDED.file_size
    RETURNING id, "key"
)
UPDATE dndshare.item_type item_type
SET icon_image_id = image.id
FROM icon_seed seed
JOIN inserted image ON image."key" = seed.object_key
WHERE item_type.id = seed.type_id;

-- The former item_type SVG is not a runtime fallback after every registered
-- collection has a raster emblem. Preserve SVGs still referenced by items or
-- dictionaries, then remove the obsolete column on upgraded databases.
DO $$
DECLARE
    old_svg_ids bigint[] := ARRAY[]::bigint[];
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'dndshare'
          AND table_name = 'item_type'
          AND column_name = 'svg_id'
    ) THEN
        EXECUTE 'SELECT COALESCE(array_agg(svg_id), ARRAY[]::bigint[]) FROM dndshare.item_type WHERE svg_id IS NOT NULL'
        INTO old_svg_ids;
        EXECUTE 'ALTER TABLE dndshare.item_type DROP COLUMN svg_id';

        DELETE FROM dndshare.svg_storage svg
        WHERE svg.id = ANY(old_svg_ids)
          AND NOT EXISTS (SELECT 1 FROM dndshare.item item WHERE item.icon_svg_id = svg.id)
          AND NOT EXISTS (SELECT 1 FROM dndshare.suggest suggest WHERE suggest.svg_id = svg.id)
          AND NOT EXISTS (SELECT 1 FROM dndshare.suggest_type suggest_type WHERE suggest_type.svg_id = svg.id);
    END IF;
END
$$;
