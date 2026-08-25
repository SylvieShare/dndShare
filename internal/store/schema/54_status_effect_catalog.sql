-- Effect cards use a dedicated bullet thesis beside the icon. Full rules remain
-- in desc and continue to power handbook detail and tooltips.
WITH addition(field) AS (
  VALUES ('{"name":"Тезис","key":"thesis","type":"textarea"}'::jsonb)
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

UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN field ->> 'key' = 'thesis'
      THEN jsonb_set(field, '{type}', '"textarea"'::jsonb, true)
      ELSE field
    END
    ORDER BY ordinality
  )
  FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY current(field, ordinality)
)
WHERE item_type.id = 15
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) field
    WHERE field ->> 'key' = 'thesis' AND field ->> 'type' IS DISTINCT FROM 'textarea'
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
       '{"code":"exhaustion","thesis":"- Уровни накапливают штрафы\n- Продолжительный отдых снимает один уровень","desc":"Истощение имеет шесть уровней. Каждый новый уровень добавляет следующий штраф; шестой уровень означает смерть. Продолжительный отдых при выполнении условий обычно снимает один уровень.","polarity":"negative","color":"#d14f4f","stacking":"single","level":1,"max_level":6,"duration":{"kind":"permanent"}}'::jsonb,
       15
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item
  WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'exhaustion'
);

INSERT INTO dndshare.item (name, name_en, data, type_id)
SELECT 'Вдохновение', 'Inspiration',
       '{"code":"inspiration","thesis":"- Преимущество на один бросок атаки, проверки или спасброска","desc":"Вдохновение можно потратить, чтобы получить преимущество на одну атаку, проверку характеристики или спасбросок.","polarity":"positive","color":"#f2bd5a","stacking":"single","duration":{"kind":"permanent"}}'::jsonb,
       15
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item
  WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'inspiration'
);

WITH canonical(code, thesis) AS (
  VALUES
    ('blinded', E'- Не видит и проваливает проверки зрения\n- Его атаки с помехой; атаки по нему с преимуществом'),
    ('charmed', E'- Не атакует и не вредит очаровавшему\n- Очаровавший имеет преимущество в социальных проверках'),
    ('deafened', E'- Не слышит\n- Проваливает проверки слуха'),
    ('frightened', E'- Помеха к проверкам характеристик и броскам атаки\n- Не может переместиться ближе к источнику испуга'),
    ('grappled', E'- Скорость 0 без бонусов\n- Заканчивается при недееспособности захватившего или разрыве дистанции'),
    ('incapacitated', E'- Не может совершать действия и реакции'),
    ('invisible', E'- Нельзя увидеть без магии или особого чувства\n- Его атаки с преимуществом; атаки по нему с помехой'),
    ('paralyzed', E'- Недееспособен, не двигается и не говорит\n- Проваливает спасброски Силы и Ловкости\n- Атаки по нему с преимуществом; попадание в 5 футах критическое'),
    ('petrified', E'- Недееспособен, неподвижен и не замечает окружение\n- Сопротивление всему урону\n- Проваливает спасброски Силы и Ловкости; атаки по нему с преимуществом'),
    ('poisoned', E'- Помеха к проверкам характеристик и броскам атаки'),
    ('prone', E'- Только ползает или встаёт за половину скорости\n- Его атаки с помехой\n- Атаки в 5 футах с преимуществом, дальше — с помехой'),
    ('restrained', E'- Скорость 0\n- Его атаки с помехой; атаки по нему с преимуществом\n- Помеха к спасброскам Ловкости'),
    ('stunned', E'- Недееспособен, не двигается и говорит сбивчиво\n- Проваливает спасброски Силы и Ловкости\n- Атаки по нему с преимуществом'),
    ('unconscious', E'- Недееспособен, падает и выпускает предметы\n- Проваливает спасброски Силы и Ловкости\n- Атаки по нему с преимуществом; попадание в 5 футах критическое'),
    ('rage', E'- Преимущество к проверкам и спасброскам Силы\n- Бонус к урону оружием на Силе\n- Сопротивление дробящему, колющему и рубящему урону'),
    ('shield_of_faith', E'- +2 к КД\n- Требует концентрации'),
    ('exhaustion', E'- Уровни накапливают штрафы\n- Продолжительный отдых снимает один уровень'),
    ('inspiration', E'- Преимущество на один бросок атаки, проверки или спасброска')
)
UPDATE dndshare.item effect
SET data = jsonb_set(effect.data, '{thesis}', to_jsonb(canonical.thesis), true)
FROM canonical
WHERE effect.type_id = 15
  AND effect.user_id IS NULL
  AND effect.data ->> 'code' = canonical.code;

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
