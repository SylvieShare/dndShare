-- Existing 3:2 race artwork is retained as a detail cover. Compact race icons
-- use a separate system-race-icons namespace and are assigned by deploy sync.
DROP INDEX IF EXISTS dndshare.idx_storage_image_system_race_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_image_system_race_key
    ON dndshare.storage_image USING btree ("key")
    WHERE user_id IS NULL AND "key" LIKE 'system-race-images/%';

WITH race_images(object_key, file_name, file_size) AS (
    VALUES
      ('system-race-images/v1/human.jpg', 'human.jpg', 202273::int8),
      ('system-race-images/v1/dwarf.jpg', 'dwarf.jpg', 238876::int8),
      ('system-race-images/v1/elf.jpg', 'elf.jpg', 246609::int8),
      ('system-race-images/v1/halfling.jpg', 'halfling.jpg', 212151::int8),
      ('system-race-images/v1/gnome.jpg', 'gnome.jpg', 256544::int8),
      ('system-race-images/v1/half-elf.jpg', 'half-elf.jpg', 217227::int8),
      ('system-race-images/v1/half-orc.jpg', 'half-orc.jpg', 208225::int8),
      ('system-race-images/v1/dragonborn.jpg', 'dragonborn.jpg', 242639::int8),
      ('system-race-images/v1/tiefling.jpg', 'tiefling.jpg', 229458::int8)
)
INSERT INTO dndshare.storage_image (
    user_id, "key", url, "type", deleted, file_name, mime_type, file_size
)
SELECT NULL, object_key,
       'https://storage.yandexcloud.net/dndshare/' || object_key,
       'item_cover', false, file_name, 'image/jpeg', file_size
FROM race_images
ON CONFLICT ("key") WHERE user_id IS NULL AND "key" LIKE 'system-race-images/%'
DO UPDATE SET "type" = 'item_cover', deleted = false, file_name = EXCLUDED.file_name,
              mime_type = EXCLUDED.mime_type, file_size = EXCLUDED.file_size;

WITH race_mapping(object_key, aliases) AS (
    VALUES
      ('system-race-images/v1/human.jpg', ARRAY['human', 'человек']),
      ('system-race-images/v1/dwarf.jpg', ARRAY['dwarf', 'дварф', 'дворф']),
      ('system-race-images/v1/elf.jpg', ARRAY['elf', 'эльф']),
      ('system-race-images/v1/halfling.jpg', ARRAY['halfling', 'полурослик']),
      ('system-race-images/v1/gnome.jpg', ARRAY['gnome', 'гном']),
      ('system-race-images/v1/half-elf.jpg', ARRAY['halfelf', 'полуэльф']),
      ('system-race-images/v1/half-orc.jpg', ARRAY['halforc', 'полуорк']),
      ('system-race-images/v1/dragonborn.jpg', ARRAY['dragonborn', 'драконорожденный']),
      ('system-race-images/v1/tiefling.jpg', ARRAY['tiefling', 'тифлинг'])
)
UPDATE dndshare.item race
SET cover_image_id = image.id,
    icon_image_id = CASE WHEN race.icon_image_id = image.id THEN NULL ELSE race.icon_image_id END
FROM race_mapping mapping
JOIN dndshare.storage_image image
  ON image."key" = mapping.object_key
 AND image."type" = 'item_cover'
 AND image.deleted = false
WHERE race.user_id IS NULL
  AND race.parent_id IS NULL
  AND race.type_id = 8
  AND (race.cover_image_id IS NULL OR race.cover_image_id = image.id)
  AND (
    regexp_replace(replace(lower(COALESCE(race.name_en, '')), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY(mapping.aliases)
    OR regexp_replace(replace(lower(race.name), 'ё', 'е'), '[^a-zа-я0-9]+', '', 'g') = ANY(mapping.aliases)
  );
