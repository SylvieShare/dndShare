-- Built-in subrace artwork follows the same S3 -> storage_image -> item contract
-- as base-race artwork, but only matches child race items.
WITH subrace_images(object_key, file_name, file_size) AS (
    VALUES
      ('system-race-images/v1/subraces/high-elf.jpg', 'high-elf.jpg', 511915::int8),
      ('system-race-images/v1/subraces/wood-elf.jpg', 'wood-elf.jpg', 529635::int8),
      ('system-race-images/v1/subraces/drow.jpg', 'drow.jpg', 527448::int8),
      ('system-race-images/v1/subraces/mountain-dwarf.jpg', 'mountain-dwarf.jpg', 524365::int8),
      ('system-race-images/v1/subraces/hill-dwarf.jpg', 'hill-dwarf.jpg', 514336::int8),
      ('system-race-images/v1/subraces/forest-gnome.jpg', 'forest-gnome.jpg', 505096::int8),
      ('system-race-images/v1/subraces/rock-gnome.jpg', 'rock-gnome.jpg', 584079::int8),
      ('system-race-images/v1/subraces/lightfoot-halfling.jpg', 'lightfoot-halfling.jpg', 613638::int8),
      ('system-race-images/v1/subraces/stout-halfling.jpg', 'stout-halfling.jpg', 520701::int8)
)
INSERT INTO dndshare.storage_image (
    user_id, "key", url, "type", deleted, file_name, mime_type, file_size
)
SELECT NULL, object_key,
       'https://storage.yandexcloud.net/dndshare/' || object_key,
       'item_icon', false, file_name, 'image/jpeg', file_size
FROM subrace_images
ON CONFLICT ("key") WHERE "type" = 'item_icon' AND user_id IS NULL AND "key" LIKE 'system-race-images/%'
DO UPDATE SET deleted = false, file_name = EXCLUDED.file_name,
              mime_type = EXCLUDED.mime_type, file_size = EXCLUDED.file_size;

WITH subrace_mapping(object_key, aliases) AS (
    VALUES
      ('system-race-images/v1/subraces/high-elf.jpg', ARRAY['highelf', 'высшийэльф']),
      ('system-race-images/v1/subraces/wood-elf.jpg', ARRAY['woodelf', 'леснойэльф']),
      ('system-race-images/v1/subraces/drow.jpg', ARRAY['darkelfdrow', 'темныйэльфдроу']),
      ('system-race-images/v1/subraces/mountain-dwarf.jpg', ARRAY['mountaindwarf', 'горныйдварф']),
      ('system-race-images/v1/subraces/hill-dwarf.jpg', ARRAY['hilldwarf', 'холмовойдварф']),
      ('system-race-images/v1/subraces/forest-gnome.jpg', ARRAY['forestgnome', 'леснойгном']),
      ('system-race-images/v1/subraces/rock-gnome.jpg', ARRAY['rockgnome', 'скальныйгном']),
      ('system-race-images/v1/subraces/lightfoot-halfling.jpg', ARRAY['lightfoothalfling', 'легконогийполурослик']),
      ('system-race-images/v1/subraces/stout-halfling.jpg', ARRAY['stouthalfling', 'коренастыйполурослик'])
)
UPDATE dndshare.item subrace
SET icon_svg_id = NULL, icon_image_id = image.id
FROM subrace_mapping mapping
JOIN dndshare.storage_image image
  ON image."key" = mapping.object_key
 AND image."type" = 'item_icon'
 AND image.deleted = false
WHERE subrace.user_id IS NULL
  AND subrace.parent_id IS NOT NULL
  AND subrace.type_id = 8
  AND (
    regexp_replace(replace(lower(COALESCE(subrace.name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY(mapping.aliases)
    OR regexp_replace(replace(lower(subrace.name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY(mapping.aliases)
  );
