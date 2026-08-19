-- Built-in class artwork uses the common item.icon_image_id -> storage_image
-- contract. Only base classes are linked; subclass presentation stays separate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_image_system_class_key
    ON dndshare.storage_image USING btree ("key")
    WHERE "type" = 'item_icon' AND user_id IS NULL AND "key" LIKE 'system-class-images/%';

WITH class_images(object_key, file_name, file_size) AS (
    VALUES
      ('system-class-images/v1/bard.jpg', 'bard.jpg', 574061::int8),
      ('system-class-images/v1/barbarian.jpg', 'barbarian.jpg', 498038::int8),
      ('system-class-images/v1/fighter.jpg', 'fighter.jpg', 545381::int8),
      ('system-class-images/v1/wizard.jpg', 'wizard.jpg', 566257::int8),
      ('system-class-images/v1/druid.jpg', 'druid.jpg', 558217::int8),
      ('system-class-images/v1/cleric.jpg', 'cleric.jpg', 596185::int8),
      ('system-class-images/v1/artificer.jpg', 'artificer.jpg', 551053::int8),
      ('system-class-images/v1/warlock.jpg', 'warlock.jpg', 497611::int8),
      ('system-class-images/v1/magus.jpg', 'magus.jpg', 527200::int8),
      ('system-class-images/v1/monk.jpg', 'monk.jpg', 531900::int8),
      ('system-class-images/v1/paladin.jpg', 'paladin.jpg', 653855::int8),
      ('system-class-images/v1/rogue.jpg', 'rogue.jpg', 440049::int8),
      ('system-class-images/v1/ranger.jpg', 'ranger.jpg', 570951::int8),
      ('system-class-images/v1/sorcerer.jpg', 'sorcerer.jpg', 575105::int8),
      ('system-class-images/v1/shaman.jpg', 'shaman.jpg', 611686::int8)
)
INSERT INTO dndshare.storage_image (user_id, "key", url, "type", deleted, file_name, mime_type, file_size)
SELECT NULL, object_key, 'https://storage.yandexcloud.net/dndshare/' || object_key,
       'item_icon', false, file_name, 'image/jpeg', file_size
FROM class_images
ON CONFLICT ("key") WHERE "type" = 'item_icon' AND user_id IS NULL AND "key" LIKE 'system-class-images/%'
DO UPDATE SET deleted = false, file_name = EXCLUDED.file_name,
              mime_type = EXCLUDED.mime_type, file_size = EXCLUDED.file_size;

WITH class_mapping(object_key, aliases) AS (
    VALUES
      ('system-class-images/v1/bard.jpg', ARRAY['bard', 'бард']),
      ('system-class-images/v1/barbarian.jpg', ARRAY['barbarian', 'варвар']),
      ('system-class-images/v1/fighter.jpg', ARRAY['fighter', 'воин']),
      ('system-class-images/v1/wizard.jpg', ARRAY['wizard', 'волшебник']),
      ('system-class-images/v1/druid.jpg', ARRAY['druid', 'друид']),
      ('system-class-images/v1/cleric.jpg', ARRAY['cleric', 'жрец']),
      ('system-class-images/v1/artificer.jpg', ARRAY['artificer', 'изобретатель']),
      ('system-class-images/v1/warlock.jpg', ARRAY['warlock', 'колдун']),
      ('system-class-images/v1/magus.jpg', ARRAY['magus', 'магус']),
      ('system-class-images/v1/monk.jpg', ARRAY['monk', 'монах']),
      ('system-class-images/v1/paladin.jpg', ARRAY['paladin', 'паладин']),
      ('system-class-images/v1/rogue.jpg', ARRAY['rogue', 'плут']),
      ('system-class-images/v1/ranger.jpg', ARRAY['ranger', 'следопыт']),
      ('system-class-images/v1/sorcerer.jpg', ARRAY['sorcerer', 'чародей']),
      ('system-class-images/v1/shaman.jpg', ARRAY['shaman', 'шаман'])
)
UPDATE dndshare.item class_item
SET icon_svg_id = NULL, icon_image_id = image.id
FROM class_mapping mapping
JOIN dndshare.storage_image image
  ON image."key" = mapping.object_key AND image."type" = 'item_icon' AND image.deleted = false
WHERE class_item.user_id IS NULL
  AND class_item.parent_id IS NULL
  AND class_item.type_id = 9
  AND (
    class_item.icon_image_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM dndshare.storage_image current_image
      WHERE current_image.id = class_item.icon_image_id
        AND current_image."key" LIKE 'system-class-images/%'
    )
  )
  AND (
    regexp_replace(replace(lower(COALESCE(class_item.name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY(mapping.aliases)
    OR regexp_replace(replace(lower(class_item.name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY(mapping.aliases)
  );
