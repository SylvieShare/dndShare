-- Canonical handbook references for PHB 2014 background grants.
-- Background tools and possessions used to be embedded in one Russian prose
-- sentence. The creation wizard now consumes item ids exclusively, so every
-- visible grant opens the same handbook record that is written to the sheet.

CREATE TEMP TABLE background_reference_items ON COMMIT DROP AS
SELECT * FROM (VALUES
    ('Священный символ (по выбору)', 'Background Holy Symbol Choice', 'gear', 'Священный символ персонажа: амулет, эмблема или реликварий на выбор.', 'Эмблема'),
    ('Молитвенник', 'Prayer Book', 'gear', 'Книга молитв и обрядов, связанная с верой персонажа.', 'Книга'),
    ('Музыкальный инструмент (по выбору)', 'Background Musical Instrument Choice', 'tool', 'Один музыкальный инструмент из справочника по выбору персонажа.', 'Набор для грима'),
    ('Подарок поклонника', 'Favor of an Admirer', 'gear', 'Памятный подарок от поклонника выступлений персонажа.', 'Тотем'),
    ('Карта родного города', 'Map of Home City', 'gear', 'Карта улиц и приметных мест родного города персонажа.', 'Пергамент (1 лист)'),
    ('Ручная мышь', 'Pet Mouse', 'gear', 'Маленькая ручная мышь, сопровождающая персонажа.', 'Тотем'),
    ('Сувенир от родителей', 'Token to Remember Parents', 'gear', 'Небольшой памятный предмет, оставшийся от родителей.', 'Тотем'),
    ('Инструменты ремесленника (по выбору)', 'Background Artisan Tools Choice', 'tool', 'Один комплект ремесленных инструментов из справочника по выбору персонажа.', 'Набор для грима'),
    ('Рекомендательное письмо гильдии', 'Guild Letter of Introduction', 'gear', 'Письмо, подтверждающее членство и репутацию персонажа в гильдии.', 'Пергамент (1 лист)'),
    ('Игровой набор (по выбору)', 'Background Gaming Set Choice', 'tool', 'Один игровой набор из справочника по выбору персонажа.', 'Набор для грима'),
    ('Свиток родословной', 'Scroll of Pedigree', 'gear', 'Свиток, подтверждающий благородное происхождение персонажа.', 'Пергамент (1 лист)'),
    ('Счастливый талисман', 'Lucky Charm', 'gear', 'Небольшой талисман, который персонаж считает счастливым.', 'Тотем'),
    ('Письмо покойного коллеги', 'Letter from a Dead Colleague', 'gear', 'Письмо с вопросом, на который покойный коллега так и не смог ответить.', 'Пергамент (1 лист)'),
    ('Свиток с записями размышлений', 'Scroll Case of Notes', 'gear', 'Свиток с записями исследований или духовных размышлений персонажа.', 'Пергамент (1 лист)'),
    ('Знак различия', 'Insignia of Rank', 'gear', 'Знак воинского звания или принадлежности к подразделению.', 'Эмблема'),
    ('Трофей с павшего врага', 'Trophy from a Fallen Enemy', 'gear', 'Памятный трофей, взятый у побеждённого противника.', 'Тотем'),
    ('Инструменты афериста (по выбору)', 'Background Con Tools Choice', 'tool', 'Набор для мошеннической схемы по выбору: десять закупоренных бутылок, утяжелённые кости, краплёные карты или кольцо-печатка вымышленного герцога.', 'Набор для грима')
) AS seed(name, name_en, equipment_category, description, icon_source_name);

INSERT INTO dndshare.item (name, name_en, type_id, data)
SELECT seed.name, seed.name_en, 2, jsonb_build_object(
    'desc', '<p>' || seed.description || '</p>',
    'equipment_category', seed.equipment_category,
    'rarity', 0,
    'available_in_starting_shop', false
)
FROM background_reference_items seed
WHERE NOT EXISTS (
    SELECT 1
    FROM dndshare.item current
    WHERE current.user_id IS NULL
      AND current.type_id = 2
      AND lower(COALESCE(current.name_en, '')) = lower(seed.name_en)
);

-- Keep the imported PHB name aligned with the current Russian catalogue.
UPDATE dndshare.item
SET name = 'Набор для фальсификации'
WHERE user_id IS NULL
  AND type_id = 2
  AND lower(COALESCE(name_en, '')) = 'forgery kit';

WITH phb AS (
    SELECT content.id
    FROM dndshare.content_source content
    JOIN dndshare.source_version version ON version.id = content.native_source_version_id
    JOIN dndshare."source" source ON source.id = content.source_id
    WHERE upper(content.code) = 'PHB'
      AND version.version = '2014'
      AND lower(source.name) = 'dnd5e'
    ORDER BY content.id
    LIMIT 1
), seeded AS (
    SELECT item.id
    FROM dndshare.item item
    JOIN background_reference_items seed
      ON lower(COALESCE(item.name_en, '')) = lower(seed.name_en)
    WHERE item.user_id IS NULL AND item.type_id = 2
)
INSERT INTO dndshare.item_content_source (item_id, content_source_id, page, primary_source)
SELECT seeded.id, phb.id, 125, true
FROM seeded CROSS JOIN phb
ON CONFLICT (item_id, content_source_id) DO UPDATE SET
    primary_source = dndshare.item_content_source.primary_source OR EXCLUDED.primary_source;

-- Give every new reference its own svg_storage row. Reusing the visual is fine;
-- sharing the storage row is not, because item icon removal must stay isolated.
DO $$
DECLARE
    target record;
    saved_svg_id bigint;
BEGIN
    FOR target IN
        SELECT item.id, source_icon."data" AS svg
        FROM background_reference_items seed
        JOIN dndshare.item item
          ON item.user_id IS NULL
         AND item.type_id = 2
         AND lower(COALESCE(item.name_en, '')) = lower(seed.name_en)
        JOIN LATERAL (
            SELECT source_item.icon_svg_id
            FROM dndshare.item source_item
            WHERE source_item.user_id IS NULL
              AND source_item.icon_svg_id IS NOT NULL
              AND lower(btrim(source_item.name)) = lower(seed.icon_source_name)
            ORDER BY source_item.id
            LIMIT 1
        ) source_item ON true
        JOIN dndshare.svg_storage source_icon ON source_icon.id = source_item.icon_svg_id
        WHERE item.icon_svg_id IS NULL AND item.icon_image_id IS NULL
        ORDER BY item.id
    LOOP
        INSERT INTO dndshare.svg_storage (data)
        VALUES (target.svg)
        RETURNING id INTO saved_svg_id;

        UPDATE dndshare.item
        SET icon_svg_id = saved_svg_id
        WHERE id = target.id
          AND icon_svg_id IS NULL
          AND icon_image_id IS NULL;
    END LOOP;
END
$$;

CREATE TEMP TABLE background_grant_links ON COMMIT DROP AS
SELECT * FROM (VALUES
    -- Acolyte
    ('Аколит', 'equipment', 1, 2, 'Священный символ (по выбору)', 1),
    ('Аколит', 'equipment', 2, 2, 'Молитвенник', 1),
    ('Аколит', 'equipment', 3, 2, 'Брусок благовоний', 5),
    ('Аколит', 'equipment', 4, 2, 'Облачение', 1),
    ('Аколит', 'equipment', 5, 2, 'Обычная одежда', 1),
    ('Аколит', 'equipment', 6, 2, 'Кошель', 1),
    -- Entertainer
    ('Артист', 'tool', 1, 2, 'Набор для грима', 1),
    ('Артист', 'tool', 2, 2, 'Музыкальный инструмент (по выбору)', 1),
    ('Артист', 'equipment', 1, 2, 'Музыкальный инструмент (по выбору)', 1),
    ('Артист', 'equipment', 2, 2, 'Подарок поклонника', 1),
    ('Артист', 'equipment', 3, 2, 'Костюм', 1),
    ('Артист', 'equipment', 4, 2, 'Кошель', 1),
    -- Urchin
    ('Беспризорник', 'tool', 1, 2, 'Набор для грима', 1),
    ('Беспризорник', 'tool', 2, 2, 'Воровские инструменты', 1),
    ('Беспризорник', 'equipment', 1, 2, 'Маленький нож', 1),
    ('Беспризорник', 'equipment', 2, 2, 'Карта родного города', 1),
    ('Беспризорник', 'equipment', 3, 2, 'Ручная мышь', 1),
    ('Беспризорник', 'equipment', 4, 2, 'Сувенир от родителей', 1),
    ('Беспризорник', 'equipment', 5, 2, 'Обычная одежда', 1),
    ('Беспризорник', 'equipment', 6, 2, 'Кошель', 1),
    -- Guild artisan
    ('Гильдейский ремесленник', 'tool', 1, 2, 'Инструменты ремесленника (по выбору)', 1),
    ('Гильдейский ремесленник', 'equipment', 1, 2, 'Инструменты ремесленника (по выбору)', 1),
    ('Гильдейский ремесленник', 'equipment', 2, 2, 'Рекомендательное письмо гильдии', 1),
    ('Гильдейский ремесленник', 'equipment', 3, 2, 'Дорожная одежда', 1),
    ('Гильдейский ремесленник', 'equipment', 4, 2, 'Кошель', 1),
    -- Noble
    ('Дворянин', 'tool', 1, 2, 'Игровой набор (по выбору)', 1),
    ('Дворянин', 'equipment', 1, 2, 'Богатая одежда', 1),
    ('Дворянин', 'equipment', 2, 2, 'Печатка', 1),
    ('Дворянин', 'equipment', 3, 2, 'Свиток родословной', 1),
    ('Дворянин', 'equipment', 4, 2, 'Кошель', 1),
    -- Sailor
    ('Моряк', 'tool', 1, 2, 'Инструменты навигатора', 1),
    ('Моряк', 'equipment', 1, 1, 'Дубинка', 1),
    ('Моряк', 'equipment', 2, 2, 'Верёвка шёлковая (50 футов)', 1),
    ('Моряк', 'equipment', 3, 2, 'Счастливый талисман', 1),
    ('Моряк', 'equipment', 4, 2, 'Обычная одежда', 1),
    ('Моряк', 'equipment', 5, 2, 'Кошель', 1),
    -- Sage
    ('Мудрец', 'equipment', 1, 2, 'Чернила (бутылочка 1 унция)', 1),
    ('Мудрец', 'equipment', 2, 2, 'Перо', 1),
    ('Мудрец', 'equipment', 3, 2, 'Маленький нож', 1),
    ('Мудрец', 'equipment', 4, 2, 'Письмо покойного коллеги', 1),
    ('Мудрец', 'equipment', 5, 2, 'Обычная одежда', 1),
    ('Мудрец', 'equipment', 6, 2, 'Кошель', 1),
    -- Folk hero
    ('Народный герой', 'tool', 1, 2, 'Инструменты ремесленника (по выбору)', 1),
    ('Народный герой', 'equipment', 1, 2, 'Инструменты ремесленника (по выбору)', 1),
    ('Народный герой', 'equipment', 2, 2, 'Лопата', 1),
    ('Народный герой', 'equipment', 3, 2, 'Котелок железный', 1),
    ('Народный герой', 'equipment', 4, 2, 'Обычная одежда', 1),
    ('Народный герой', 'equipment', 5, 2, 'Кошель', 1),
    -- Hermit
    ('Отшельник', 'tool', 1, 2, 'Набор травника', 1),
    ('Отшельник', 'equipment', 1, 2, 'Свиток с записями размышлений', 1),
    ('Отшельник', 'equipment', 2, 2, 'Набор травника', 1),
    ('Отшельник', 'equipment', 3, 2, 'Одеяло', 1),
    ('Отшельник', 'equipment', 4, 2, 'Обычная одежда', 1),
    -- Criminal
    ('Преступник', 'tool', 1, 2, 'Игровой набор (по выбору)', 1),
    ('Преступник', 'tool', 2, 2, 'Воровские инструменты', 1),
    ('Преступник', 'equipment', 1, 2, 'Лом', 1),
    ('Преступник', 'equipment', 2, 2, 'Комплект обычной тёмной одежды с капюшоном', 1),
    ('Преступник', 'equipment', 3, 2, 'Кошель', 1),
    -- Soldier
    ('Солдат', 'tool', 1, 2, 'Игровой набор (по выбору)', 1),
    ('Солдат', 'equipment', 1, 2, 'Знак различия', 1),
    ('Солдат', 'equipment', 2, 2, 'Трофей с павшего врага', 1),
    ('Солдат', 'equipment', 3, 2, 'Кости', 1),
    ('Солдат', 'equipment', 4, 2, 'Обычная одежда', 1),
    ('Солдат', 'equipment', 5, 2, 'Кошель', 1),
    -- Outlander
    ('Чужеземец', 'tool', 1, 2, 'Музыкальный инструмент (по выбору)', 1),
    ('Чужеземец', 'equipment', 1, 1, 'Боевой посох', 1),
    ('Чужеземец', 'equipment', 2, 2, 'Охотничий капкан', 1),
    ('Чужеземец', 'equipment', 3, 2, 'Тотем', 1),
    ('Чужеземец', 'equipment', 4, 2, 'Дорожная одежда', 1),
    ('Чужеземец', 'equipment', 5, 2, 'Кошель', 1),
    -- Charlatan
    ('Шарлатан', 'tool', 1, 2, 'Набор для грима', 1),
    ('Шарлатан', 'tool', 2, 2, 'Набор для фальсификации', 1),
    ('Шарлатан', 'equipment', 1, 2, 'Обычная одежда', 1),
    ('Шарлатан', 'equipment', 2, 2, 'Набор для грима', 1),
    ('Шарлатан', 'equipment', 3, 2, 'Инструменты афериста (по выбору)', 1),
    ('Шарлатан', 'equipment', 4, 2, 'Кошель', 1)
) AS grant_row(background_name, section, position, item_type_id, item_name, count);

DO $$
DECLARE
    missing_links text;
BEGIN
    SELECT string_agg(grant_row.background_name || ': ' || grant_row.item_name, ', ' ORDER BY grant_row.background_name, grant_row.position)
    INTO missing_links
    FROM background_grant_links grant_row
    WHERE NOT EXISTS (
        SELECT 1
        FROM dndshare.item item
        WHERE item.user_id IS NULL
          AND item.type_id = grant_row.item_type_id
          AND lower(btrim(item.name)) = lower(grant_row.item_name)
    );

    IF missing_links IS NOT NULL THEN
        RAISE EXCEPTION 'background handbook references are missing: %', missing_links;
    END IF;
END
$$;

CREATE TEMP TABLE background_starting_coins ON COMMIT DROP AS
SELECT * FROM (VALUES
    ('Аколит', 3, 15), ('Артист', 3, 15), ('Беспризорник', 3, 10),
    ('Гильдейский ремесленник', 3, 15), ('Дворянин', 3, 25), ('Моряк', 3, 10),
    ('Мудрец', 3, 10), ('Народный герой', 3, 10), ('Отшельник', 3, 5),
    ('Преступник', 3, 15), ('Солдат', 3, 10), ('Чужеземец', 3, 10),
    ('Шарлатан', 3, 15)
) AS coins(background_name, currency_id, amount);

WITH resolved AS (
    SELECT grant_row.background_name, grant_row.section, grant_row.position, grant_row.count, linked.id AS item_id
    FROM background_grant_links grant_row
    JOIN LATERAL (
        SELECT item.id
        FROM dndshare.item item
        WHERE item.user_id IS NULL
          AND item.type_id = grant_row.item_type_id
          AND lower(btrim(item.name)) = lower(grant_row.item_name)
        ORDER BY item.id
        LIMIT 1
    ) linked ON true
), grants AS (
    SELECT background_name,
           COALESCE(jsonb_agg(jsonb_build_object('item_id', item_id, 'count', count) ORDER BY position)
               FILTER (WHERE section = 'tool'), '[]'::jsonb) AS tool_items,
           COALESCE(jsonb_agg(jsonb_build_object('item_id', item_id, 'count', count) ORDER BY position)
               FILTER (WHERE section = 'equipment'), '[]'::jsonb) AS equipment_items
    FROM resolved
    GROUP BY background_name
), coins AS (
    SELECT background_name,
           jsonb_agg(jsonb_build_object('currency_id', currency_id, 'amount', amount) ORDER BY currency_id) AS starting_coins
    FROM background_starting_coins
    GROUP BY background_name
)
UPDATE dndshare.item background
SET data = (background.data - 'equipment' - 'tool_items' - 'equipment_items' - 'starting_coins')
    || jsonb_build_object(
        'tool_items', COALESCE(grants.tool_items, '[]'::jsonb),
        'equipment_items', COALESCE(grants.equipment_items, '[]'::jsonb),
        'starting_coins', COALESCE(coins.starting_coins, '[]'::jsonb)
    )
FROM grants
JOIN coins USING (background_name)
WHERE background.user_id IS NULL
  AND background.type_id = 11
  AND lower(btrim(background.name)) = lower(grants.background_name);

-- Backgrounds without a tool proficiency still receive an explicit empty list.
UPDATE dndshare.item background
SET data = jsonb_set(background.data, '{tool_items}', '[]'::jsonb, true)
WHERE background.user_id IS NULL
  AND background.type_id = 11
  AND background.name IN ('Аколит', 'Мудрец')
  AND NOT (background.data ? 'tool_items');

UPDATE dndshare.item_type item_type
SET fields = (
    SELECT COALESCE(jsonb_agg(field ORDER BY ordinal), '[]'::jsonb)
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY AS existing(field, ordinal)
    WHERE field ->> 'key' NOT IN ('equipment', 'tool_items', 'equipment_items', 'starting_coins')
) || '[
  {"name":"Инструменты справочника","key":"tool_items","type":"object_array","fields":[{"name":"Предмет справочника (ID)","key":"item_id","type":"int"},{"name":"Количество","key":"count","type":"int","default":1}]},
  {"name":"Стартовое снаряжение справочника","key":"equipment_items","type":"object_array","fields":[{"name":"Предмет справочника (ID)","key":"item_id","type":"int"},{"name":"Количество","key":"count","type":"int","default":1}]},
  {"name":"Стартовые монеты","key":"starting_coins","type":"object_array","fields":[{"name":"Валюта","key":"currency_id","type":"suggest","suggest_id":17},{"name":"Количество","key":"amount","type":"int"}]}
]'::jsonb
WHERE item_type.id = 11;

UPDATE dndshare.item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = 2 AND item.user_id IS NULL
)
WHERE id = 2;
