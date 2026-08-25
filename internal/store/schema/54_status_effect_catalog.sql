-- Effect cards use a dedicated short thesis beside the icon. Full rules remain
-- in desc and continue to power handbook detail and tooltips.
WITH addition(field) AS (
  VALUES ('{"name":"Тезис","key":"thesis","type":"text"}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id = 15
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'thesis'
  );

WITH prepared AS (
  SELECT id,
         regexp_replace(COALESCE(data ->> 'desc', ''), '<[^>]+>', '', 'g') AS clean_desc
  FROM dndshare.item
  WHERE type_id = 15
    AND COALESCE(data ->> 'desc', '') <> ''
), theses AS (
  SELECT id,
         left(clean_desc, 180) AS legacy_thesis,
         CASE
           WHEN length(clean_desc) <= 48 THEN clean_desc
           ELSE regexp_replace(left(clean_desc, 48), '\s+\S*$', '')
         END AS short_thesis
  FROM prepared
)
UPDATE dndshare.item item
SET data = jsonb_set(
  COALESCE(item.data, '{}'::jsonb),
  '{thesis}',
  to_jsonb(theses.short_thesis),
  true
)
FROM theses
WHERE item.id = theses.id
  AND (
    COALESCE(item.data ->> 'thesis', '') = ''
    OR item.data ->> 'thesis' = theses.legacy_thesis
  );

INSERT INTO dndshare.item (name, name_en, data, type_id)
SELECT 'Истощение', 'Exhaustion',
       '{"code":"exhaustion","thesis":"Штрафы растут с уровнем.","desc":"Истощение имеет шесть уровней. Каждый новый уровень добавляет следующий штраф; шестой уровень означает смерть. Продолжительный отдых при выполнении условий обычно снимает один уровень.","polarity":"negative","color":"#d14f4f","stacking":"single","level":1,"max_level":6,"duration":{"kind":"permanent"}}'::jsonb,
       15
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item
  WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'exhaustion'
);

INSERT INTO dndshare.item (name, name_en, data, type_id)
SELECT 'Вдохновение', 'Inspiration',
       '{"code":"inspiration","thesis":"Преимущество на один бросок.","desc":"Вдохновение можно потратить, чтобы получить преимущество на одну атаку, проверку характеристики или спасбросок.","polarity":"positive","color":"#f2bd5a","stacking":"single","duration":{"kind":"permanent"}}'::jsonb,
       15
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item
  WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'inspiration'
);

UPDATE dndshare.item
SET data = jsonb_set(
  data,
  '{thesis}',
  to_jsonb(CASE data ->> 'code'
    WHEN 'exhaustion' THEN 'Штрафы растут с уровнем.'
    ELSE 'Преимущество на один бросок.'
  END),
  true
)
WHERE type_id = 15
  AND user_id IS NULL
  AND data ->> 'code' IN ('exhaustion', 'inspiration');

CREATE UNIQUE INDEX IF NOT EXISTS idx_storage_image_static_status_effect_media_key
  ON dndshare.storage_image USING btree ("key")
  WHERE user_id IS NULL AND "key" LIKE 'static-status-effect-media/%';

WITH media_seed(object_key, image_url, media_type, file_name, mime_type, file_size) AS (
  VALUES
    ('static-status-effect-media/v1/exhaustion/icon.png', '/static/status-effects/exhaustion-icon.png', 'item_icon', 'exhaustion-icon.png', 'image/png', 62791::bigint),
    ('static-status-effect-media/v1/exhaustion/cover.jpg', '/static/status-effects/exhaustion-cover.jpg', 'item_cover', 'exhaustion-cover.jpg', 'image/jpeg', 76410::bigint),
    ('static-status-effect-media/v1/inspiration/icon.png', '/static/status-effects/inspiration-icon.png', 'item_icon', 'inspiration-icon.png', 'image/png', 77381::bigint),
    ('static-status-effect-media/v1/inspiration/cover.jpg', '/static/status-effects/inspiration-cover.jpg', 'item_cover', 'inspiration-cover.jpg', 'image/jpeg', 159127::bigint)
)
INSERT INTO dndshare.storage_image (
  user_id, "key", url, "type", deleted, file_name, mime_type, file_size
)
SELECT NULL, object_key, image_url, media_type, false, file_name, mime_type, file_size
FROM media_seed
ON CONFLICT ("key") WHERE user_id IS NULL AND "key" LIKE 'static-status-effect-media/%'
DO UPDATE SET
  url = EXCLUDED.url,
  "type" = EXCLUDED."type",
  deleted = false,
  file_name = EXCLUDED.file_name,
  mime_type = EXCLUDED.mime_type,
  file_size = EXCLUDED.file_size;

UPDATE dndshare.item effect
SET icon_svg_id = NULL,
    icon_image_id = icon.id,
    cover_image_id = cover.id
FROM dndshare.storage_image icon,
     dndshare.storage_image cover
WHERE effect.type_id = 15
  AND effect.user_id IS NULL
  AND effect.data ->> 'code' IN ('exhaustion', 'inspiration')
  AND icon."key" = 'static-status-effect-media/v1/' || (effect.data ->> 'code') || '/icon.png'
  AND cover."key" = 'static-status-effect-media/v1/' || (effect.data ->> 'code') || '/cover.jpg'
  AND icon.deleted = false
  AND cover.deleted = false;

UPDATE dndshare.item_type item_type
SET count_items = (
  SELECT COUNT(*) FROM dndshare.item item
  WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id = 15;
