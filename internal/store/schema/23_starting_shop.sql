-- Player's Handbook 2014 shop catalogue used by the character-creation wizard.
-- The local Russian PHB in docs/ is authoritative for names, prices and weights.

-- Types 1-6 historically arrived with the imported catalogue. This migration
-- creates type 2 on a clean database because it also seeds PHB tools there.
INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (
    2,
    'Вещи',
    '[{"key":"desc","name":"Описание","type":"description"},{"key":"armor","name":"Доспех","type":"object","fields":[{"key":"ac","name":"Базовый КД","type":"int"},{"key":"use_dex","name":"Добавлять Ловкость","type":"bool"},{"key":"dex_cap","name":"Максимум бонуса Ловкости","type":"int"},{"key":"shield","name":"Это щит","type":"bool"},{"key":"shield_bonus","name":"Бонус щита","type":"int"}]},{"key":"cost","name":"Стоимость","type":"int_by_suggest","suggest_type_id":17},{"key":"weight","name":"Вес","type":"int"},{"key":"is_container","name":"Контейнер","type":"bool"},{"key":"consumable","name":"Расходуемое","type":"bool"},{"key":"equipment_category","name":"Категория снаряжения","type":"select","filter":true,"options":[{"value":"gear","label":"Снаряжение"},{"value":"tool","label":"Инструмент"},{"value":"pack","label":"Набор снаряжения"}]},{"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}]'::jsonb,
    (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1),
    '#a97852',
    false,
    'Обычное снаряжение, готовые наборы и инструменты.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (
    12,
    'Доспехи',
    '[{"key":"desc","name":"Описание","type":"description"},{"key":"category","name":"Категория доспеха","type":"select","filter":true,"options":[{"value":"light","label":"Лёгкий доспех"},{"value":"medium","label":"Средний доспех"},{"value":"heavy","label":"Тяжёлый доспех"},{"value":"shield","label":"Щит"}]},{"key":"armor","name":"Правило КД","type":"object","fields":[{"key":"ac","name":"Базовый КД","type":"int"},{"key":"use_dex","name":"Добавлять Ловкость","type":"bool"},{"key":"dex_cap","name":"Максимум бонуса Ловкости","type":"int"},{"key":"shield","name":"Это щит","type":"bool"},{"key":"shield_bonus","name":"Бонус щита","type":"int"}]},{"key":"strength_required","name":"Требуемая Сила","type":"int"},{"key":"stealth_disadvantage","name":"Помеха Скрытности","type":"boolean"},{"key":"cost","name":"Стоимость","type":"int_by_suggest","suggest_type_id":17},{"key":"weight","name":"Вес","type":"int"},{"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}]'::jsonb,
    (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1),
    '#8f9aa8',
    false,
    'Обычные доспехи и щиты: класс доспеха, ограничения, стоимость и вес.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    fields = EXCLUDED.fields,
    source_id = EXCLUDED.source_id,
    color = EXCLUDED.color,
    description = EXCLUDED.description;

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (
    13,
    'Транспорт',
    '[{"key":"desc","name":"Описание","type":"description"},{"key":"category","name":"Категория транспорта","type":"select","filter":true,"options":[{"value":"mount","label":"Скакун"},{"value":"tack","label":"Сёдла и упряжь"},{"value":"land_vehicle","label":"Наземный транспорт"},{"value":"water_vehicle","label":"Водный транспорт"}]},{"key":"speed","name":"Скорость","type":"text"},{"key":"carrying_capacity","name":"Грузоподъёмность, фнт.","type":"int"},{"key":"cost","name":"Стоимость","type":"int_by_suggest","suggest_type_id":17},{"key":"weight","name":"Вес","type":"int"},{"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}]'::jsonb,
    (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1),
    '#b07a4b',
    false,
    'Скакуны, упряжь, наземный и водный транспорт из Книги игрока.'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    fields = EXCLUDED.fields,
    source_id = EXCLUDED.source_id,
    color = EXCLUDED.color,
    description = EXCLUDED.description;

-- Existing catalogues gain the same stable flag, so the future shop can query
-- weapons, gear, potions, armor and transport without type-specific heuristics.
WITH additions(type_id, field) AS (
    VALUES
        (1, '{"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}'::jsonb),
        (2, '{"key":"equipment_category","name":"Категория снаряжения","type":"select","filter":true,"options":[{"value":"gear","label":"Снаряжение"},{"value":"tool","label":"Инструмент"},{"value":"pack","label":"Набор снаряжения"}]}'::jsonb),
        (2, '{"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}'::jsonb),
        (10, '{"key":"available_in_starting_shop","name":"Доступно в магазине при создании","type":"boolean","filter":true}'::jsonb)
), missing AS (
    SELECT additions.type_id, jsonb_agg(additions.field) AS fields
    FROM additions
    JOIN dndshare.item_type item_type ON item_type.id = additions.type_id
    WHERE NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
        WHERE current ->> 'key' = additions.field ->> 'key'
    )
    GROUP BY additions.type_id
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || missing.fields
FROM missing
WHERE item_type.id = missing.type_id;

CREATE TEMP TABLE starting_shop_armor ON COMMIT DROP AS
SELECT * FROM (VALUES
    ('Стёганый доспех', 'Padded Armor', 'light', 5::numeric, 8::numeric, 11, true, NULL::int, NULL::int, true, false, NULL::int, 'Лёгкий многослойный доспех; при попытке скрыться создаёт помеху.'),
    ('Кожаный доспех', 'Leather Armor', 'light', 10, 10, 11, true, NULL, NULL, false, false, NULL, 'Лёгкий доспех из укреплённой кожи, не ограничивающий подвижность.'),
    ('Проклёпанная кожа', 'Studded Leather Armor', 'light', 45, 13, 12, true, NULL, NULL, false, false, NULL, 'Кожаный доспех, усиленный заклёпками и шипами.'),
    ('Шкурный доспех', 'Hide Armor', 'medium', 10, 12, 12, true, 2, NULL, false, false, NULL, 'Средний доспех из толстых шкур и меха.'),
    ('Кольчужная рубаха', 'Chain Shirt', 'medium', 50, 20, 13, true, 2, NULL, false, false, NULL, 'Кольчужная рубаха, которую носят между слоями одежды или кожи.'),
    ('Чешуйчатый доспех', 'Scale Mail', 'medium', 50, 45, 14, true, 2, NULL, true, false, NULL, 'Средний доспех из перекрывающихся металлических чешуек; мешает скрытности.'),
    ('Кираса', 'Breastplate', 'medium', 400, 20, 14, true, 2, NULL, false, false, NULL, 'Металлическая кираса с гибкой защитой остальных частей тела.'),
    ('Полулаты', 'Half Plate Armor', 'medium', 750, 40, 15, true, 2, NULL, true, false, NULL, 'Комплект формованных металлических пластин; при скрытности создаёт помеху.'),
    ('Колечный доспех', 'Ring Mail', 'heavy', 30, 40, 14, false, NULL, NULL, true, false, NULL, 'Тяжёлый кожаный доспех с нашитыми металлическими кольцами.'),
    ('Кольчуга', 'Chain Mail', 'heavy', 75, 55, 16, false, NULL, 13, true, false, NULL, 'Тяжёлый кольчужный комплект; требует Силу 13 и мешает скрытности.'),
    ('Наборный доспех', 'Splint Armor', 'heavy', 200, 60, 17, false, NULL, 15, true, false, NULL, 'Тяжёлый доспех из металлических полос; требует Силу 15 и мешает скрытности.'),
    ('Латы', 'Plate Armor', 'heavy', 1500, 65, 18, false, NULL, 15, true, false, NULL, 'Полный латный доспех; требует Силу 15 и мешает скрытности.'),
    ('Щит', 'Shield', 'shield', 10, 6, NULL, false, NULL, NULL, false, true, 2, 'Щит занимает одну руку и увеличивает КД на 2.')
) AS seed(name, name_en, category, cost, weight, ac, use_dex, dex_cap, strength_required, stealth_disadvantage, shield, shield_bonus, description);

-- The legacy magic-item import used the generic English name "Shield" for all
-- three enhancement tiers. An earlier broad name migration could therefore
-- mistake them for the mundane shield. Their stable ids/icons identify the
-- canonical PHB rows and let startup restore their original catalogue role.
UPDATE dndshare.item item
SET type_id = 2,
    name = seed.name,
    name_en = 'Shield',
    data = jsonb_build_object(
        'desc', '<p>' || seed.description || '</p>',
        'armor', jsonb_build_object('shield', true, 'shield_bonus', seed.shield_bonus),
        'cost', jsonb_build_object('value', NULL, 'suggest_id', NULL),
        'weight', 6,
        'rarity', seed.rarity
    )
FROM (VALUES
    (92::bigint, 207::bigint, 'Щит +1', 1, 3, 'Магический щит даёт дополнительный бонус +1 к КД сверх обычного бонуса щита.'),
    (112, 208, 'Щит +2', 2, 4, 'Магический щит даёт дополнительный бонус +2 к КД сверх обычного бонуса щита.'),
    (304, 209, 'Щит +3', 3, 5, 'Магический щит даёт дополнительный бонус +3 к КД сверх обычного бонуса щита.')
) AS seed(id, icon_svg_id, name, rarity, shield_bonus, description)
WHERE item.user_id IS NULL
  AND item.id = seed.id
  AND item.icon_svg_id = seed.icon_svg_id
  AND lower(COALESCE(item.name_en, '')) = 'shield';

-- Older databases may already contain mundane armor in the generic gear type.
-- Move only shared PHB rows; user-created and magical shields remain untouched.
UPDATE dndshare.item item
SET type_id = 12
FROM starting_shop_armor seed
WHERE item.user_id IS NULL
  AND item.type_id = 2
  AND lower(COALESCE(item.name_en, '')) = lower(seed.name_en)
  AND COALESCE(item.data ->> 'rarity', '0') = '0'
  AND EXISTS (
      SELECT 1
      FROM dndshare.item_content_source link
      JOIN dndshare.content_source content ON content.id = link.content_source_id
      JOIN dndshare.source_version version ON version.id = content.native_source_version_id
      WHERE link.item_id = item.id AND upper(content.code) = 'PHB' AND version.version = '2014'
  );

INSERT INTO dndshare.item (name, name_en, type_id, data)
SELECT seed.name, seed.name_en, 12, '{}'::jsonb
FROM starting_shop_armor seed
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare.item current
    WHERE current.user_id IS NULL AND current.type_id = 12
      AND lower(COALESCE(current.name_en, '')) = lower(seed.name_en)
);

UPDATE dndshare.item item
SET name = seed.name,
    name_en = seed.name_en,
    data = jsonb_strip_nulls(jsonb_build_object(
        'desc', '<p>' || seed.description || '</p>',
        'category', seed.category,
        'armor', jsonb_strip_nulls(jsonb_build_object(
            'ac', seed.ac,
            'use_dex', seed.use_dex,
            'dex_cap', seed.dex_cap,
            'shield', seed.shield,
            'shield_bonus', seed.shield_bonus
        )),
        'strength_required', seed.strength_required,
        'stealth_disadvantage', seed.stealth_disadvantage,
        'cost', jsonb_build_object('value', seed.cost, 'suggest_id', 3),
        'weight', seed.weight,
        'available_in_starting_shop', true
    ))
FROM starting_shop_armor seed
WHERE item.user_id IS NULL AND item.type_id = 12
  AND lower(COALESCE(item.name_en, '')) = lower(seed.name_en)
  AND COALESCE(item.data ->> 'rarity', '0') = '0';

CREATE TEMP TABLE starting_shop_tools ON COMMIT DROP AS
SELECT * FROM (VALUES
    ('Воровские инструменты', 'Thieves'' Tools', 25::numeric, 3, 1::numeric, 'Набор для вскрытия замков, обезвреживания ловушек и других задач вора.'),
    ('Драконьи шахматы', 'Dragonchess Set', 1, 3, 0.5, 'Игровой набор с фигурками и доской для драконьих шахмат.'),
    ('Карты', 'Playing Card Set', 5, 2, 0, 'Колода карт для азартных и салонных игр.'),
    ('Кости', 'Dice Set', 1, 2, 0, 'Набор игральных костей.'),
    ('Ставка трёх драконов', 'Three-Dragon Ante Set', 1, 3, 0, 'Карточный набор для игры «Ставка трёх драконов».'),
    ('Инструменты навигатора', 'Navigator''s Tools', 25, 3, 2, 'Приборы и карты для прокладывания курса и навигации.'),
    ('Инструменты отравителя', 'Poisoner''s Kit', 50, 3, 2, 'Набор флаконов и химикатов для работы с ядами.'),
    ('Инструменты алхимика', 'Alchemist''s Supplies', 50, 3, 8, 'Ремесленные инструменты алхимика.'),
    ('Инструменты гончара', 'Potter''s Tools', 10, 3, 3, 'Ремесленные инструменты гончара.'),
    ('Инструменты жестянщика', 'Tinker''s Tools', 50, 3, 10, 'Ремесленные инструменты жестянщика.'),
    ('Инструменты каллиграфа', 'Calligrapher''s Supplies', 10, 3, 5, 'Ремесленные инструменты каллиграфа.'),
    ('Инструменты каменщика', 'Mason''s Tools', 10, 3, 8, 'Ремесленные инструменты каменщика.'),
    ('Инструменты картографа', 'Cartographer''s Tools', 15, 3, 6, 'Ремесленные инструменты картографа.'),
    ('Инструменты кожевника', 'Leatherworker''s Tools', 5, 3, 5, 'Ремесленные инструменты кожевника.'),
    ('Инструменты кузнеца', 'Smith''s Tools', 20, 3, 8, 'Ремесленные инструменты кузнеца.'),
    ('Инструменты пивовара', 'Brewer''s Supplies', 20, 3, 9, 'Ремесленные инструменты пивовара.'),
    ('Инструменты плотника', 'Carpenter''s Tools', 8, 3, 6, 'Ремесленные инструменты плотника.'),
    ('Инструменты повара', 'Cook''s Utensils', 1, 3, 8, 'Ремесленные инструменты повара.'),
    ('Инструменты резчика по дереву', 'Woodcarver''s Tools', 1, 3, 5, 'Ремесленные инструменты резчика по дереву.'),
    ('Инструменты сапожника', 'Cobbler''s Tools', 5, 3, 5, 'Ремесленные инструменты сапожника.'),
    ('Инструменты стеклодува', 'Glassblower''s Tools', 30, 3, 5, 'Ремесленные инструменты стеклодува.'),
    ('Инструменты ткача', 'Weaver''s Tools', 1, 3, 5, 'Ремесленные инструменты ткача.'),
    ('Инструменты художника', 'Painter''s Supplies', 10, 3, 5, 'Ремесленные инструменты художника.'),
    ('Инструменты ювелира', 'Jeweler''s Tools', 25, 3, 2, 'Ремесленные инструменты ювелира.'),
    ('Барабаны', 'Drum', 6, 3, 3, 'Музыкальный инструмент: барабаны.'),
    ('Виола', 'Viol', 30, 3, 1, 'Струнный музыкальный инструмент.'),
    ('Волынка', 'Bagpipes', 30, 3, 6, 'Духовой музыкальный инструмент.'),
    ('Лира', 'Lyre', 30, 3, 2, 'Струнный музыкальный инструмент.'),
    ('Лютня', 'Lute', 35, 3, 2, 'Струнный музыкальный инструмент.'),
    ('Рожок', 'Horn', 3, 3, 2, 'Духовой музыкальный инструмент.'),
    ('Свирель', 'Pan Flute', 12, 3, 2, 'Духовой музыкальный инструмент.'),
    ('Флейта', 'Flute', 2, 3, 1, 'Духовой музыкальный инструмент.'),
    ('Цимбалы', 'Dulcimer', 25, 3, 10, 'Струнный музыкальный инструмент.'),
    ('Шалмей', 'Shawm', 2, 3, 1, 'Духовой музыкальный инструмент.'),
    ('Набор для грима', 'Disguise Kit', 25, 3, 3, 'Косметика и принадлежности для изменения внешности.'),
    ('Набор для фальсификации', 'Forgery Kit', 15, 3, 5, 'Принадлежности для создания и распознавания поддельных документов.'),
    ('Набор травника', 'Herbalism Kit', 5, 3, 3, 'Инструменты для распознавания и применения растений.' )
) AS seed(name, name_en, cost, currency_id, weight, description);

INSERT INTO dndshare.item (name, name_en, type_id, data)
SELECT seed.name, seed.name_en, 2, '{}'::jsonb
FROM starting_shop_tools seed
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare.item current
    WHERE current.user_id IS NULL AND current.type_id = 2
      AND lower(COALESCE(current.name_en, '')) = lower(seed.name_en)
);

UPDATE dndshare.item item
SET data = item.data || jsonb_build_object(
    'desc', '<p>' || seed.description || '</p>',
    'equipment_category', 'tool',
    'cost', jsonb_build_object('value', seed.cost, 'suggest_id', seed.currency_id),
    'weight', seed.weight,
    'rarity', 0,
    'available_in_starting_shop', true
)
FROM starting_shop_tools seed
WHERE item.user_id IS NULL AND item.type_id = 2
  AND lower(COALESCE(item.name_en, '')) = lower(seed.name_en);

CREATE TEMP TABLE starting_shop_transport ON COMMIT DROP AS
SELECT * FROM (VALUES
    ('Боевой конь', 'Warhorse', 'mount', 400::numeric, 3, NULL::numeric, '60 фт.', 540, 'Боевой скакун, обученный сохранять спокойствие в сражении.'),
    ('Верблюд', 'Camel', 'mount', 50, 3, NULL, '50 фт.', 480, 'Выносливый скакун для путешествий и перевозки грузов.'),
    ('Лошадь ездовая', 'Riding Horse', 'mount', 75, 3, NULL, '60 фт.', 480, 'Быстрая лошадь для верховой езды.'),
    ('Лошадь тягловая', 'Draft Horse', 'mount', 50, 3, NULL, '40 фт.', 540, 'Сильная лошадь для перевозки грузов и тяги транспорта.'),
    ('Мастиф', 'Mastiff', 'mount', 25, 3, NULL, '40 фт.', 195, 'Крупная обученная собака, подходящая как скакун для Маленького существа.'),
    ('Осёл или мул', 'Donkey or Mule', 'mount', 8, 3, NULL, '40 фт.', 420, 'Надёжное вьючное животное.'),
    ('Пони', 'Pony', 'mount', 30, 3, NULL, '40 фт.', 225, 'Небольшой скакун для верховой езды и перевозки груза.'),
    ('Слон', 'Elephant', 'mount', 200, 3, NULL, '40 фт.', 1320, 'Огромный и чрезвычайно грузоподъёмный скакун.'),
    ('Корм (в день)', 'Feed (per day)', 'tack', 5, 1, 10, NULL, NULL, 'Дневной запас корма для скакуна.'),
    ('Седельные сумки', 'Saddlebags', 'tack', 4, 3, 8, NULL, NULL, 'Парные сумки для перевозки вещей на скакуне.'),
    ('Седло, боевое', 'Saddle, Military', 'tack', 20, 3, 30, NULL, NULL, 'Боевое седло помогает всаднику удержаться верхом.'),
    ('Седло, грузовое', 'Saddle, Pack', 'tack', 5, 3, 15, NULL, NULL, 'Грузовое седло для крепления поклажи.'),
    ('Седло, ездовое', 'Saddle, Riding', 'tack', 10, 3, 25, NULL, NULL, 'Обычное седло для верховой езды.'),
    ('Седло, экзотическое', 'Saddle, Exotic', 'tack', 60, 3, 40, NULL, NULL, 'Особое седло для водного или летающего скакуна.'),
    ('Упряжь и уздечка', 'Bit and Bridle', 'tack', 2, 3, 1, NULL, NULL, 'Упряжь для управления скакуном.'),
    ('Карета', 'Carriage', 'land_vehicle', 100, 3, 600, NULL, NULL, 'Закрытый колёсный транспорт для пассажиров.'),
    ('Коляска', 'Chariot', 'land_vehicle', 250, 3, 100, NULL, NULL, 'Лёгкий двухколёсный транспорт, рассчитанный на быструю езду.'),
    ('Сани', 'Sled', 'land_vehicle', 20, 3, 300, NULL, NULL, 'Наземный транспорт на полозьях.'),
    ('Телега', 'Cart', 'land_vehicle', 15, 3, 200, NULL, NULL, 'Простой двухколёсный грузовой транспорт.'),
    ('Фургон', 'Wagon', 'land_vehicle', 35, 3, 400, NULL, NULL, 'Крытый четырёхколёсный транспорт для груза и пассажиров.'),
    ('Военный корабль', 'Warship', 'water_vehicle', 25000, 3, NULL, '2,5 мили/ч', NULL, 'Крупный военный парусный корабль.'),
    ('Галера', 'Galley', 'water_vehicle', 30000, 3, NULL, '4 мили/ч', NULL, 'Большое гребное судно.'),
    ('Килевая лодка', 'Keelboat', 'water_vehicle', 3000, 3, NULL, '1 миля/ч', NULL, 'Небольшое парусное или гребное судно.'),
    ('Ладья', 'Longship', 'water_vehicle', 10000, 3, NULL, '3 мили/ч', NULL, 'Длинное мореходное гребное судно.'),
    ('Парусный корабль', 'Sailing Ship', 'water_vehicle', 10000, 3, NULL, '2 мили/ч', NULL, 'Парусное морское торговое судно.'),
    ('Шлюпка', 'Rowboat', 'water_vehicle', 50, 3, 100, '1,5 мили/ч', NULL, 'Небольшая гребная лодка; её можно переносить по суше.')
) AS seed(name, name_en, category, cost, currency_id, weight, speed, carrying_capacity, description);

INSERT INTO dndshare.item (name, name_en, type_id, data)
SELECT seed.name, seed.name_en, 13, '{}'::jsonb
FROM starting_shop_transport seed
WHERE NOT EXISTS (
    SELECT 1 FROM dndshare.item current
    WHERE current.user_id IS NULL AND current.type_id = 13
      AND lower(COALESCE(current.name_en, '')) = lower(seed.name_en)
);

UPDATE dndshare.item item
SET name = seed.name,
    name_en = seed.name_en,
    data = jsonb_strip_nulls(jsonb_build_object(
        'desc', '<p>' || seed.description || '</p>',
        'category', seed.category,
        'cost', jsonb_build_object('value', seed.cost, 'suggest_id', seed.currency_id),
        'weight', seed.weight,
        'speed', seed.speed,
        'carrying_capacity', seed.carrying_capacity,
        'available_in_starting_shop', true
    ))
FROM starting_shop_transport seed
WHERE item.user_id IS NULL AND item.type_id = 13
  AND lower(COALESCE(item.name_en, '')) = lower(seed.name_en);

-- All priced, common PHB gear rows are the purchasable adventuring-gear table.
-- Zero-cost pack components imported as standalone helper rows remain excluded.
UPDATE dndshare.item item
SET data = item.data || jsonb_build_object(
    'available_in_starting_shop', true,
    'equipment_category', CASE
        WHEN item.name IN (
            'Набор артиста', 'Набор взломщика', 'Набор дипломата',
            'Набор исследователя подземелий', 'Набор путешественника',
            'Набор священника', 'Набор учёного'
        ) THEN 'pack'
        ELSE COALESCE(item.data ->> 'equipment_category', 'gear')
    END,
    'desc', CASE
        WHEN btrim(COALESCE(item.data ->> 'desc', '')) = ''
            THEN '<p>' || item.name || ' — покупаемое снаряжение из Книги игрока (2014).</p>'
        ELSE item.data ->> 'desc'
    END
)
WHERE item.user_id IS NULL
  AND item.type_id = 2
  AND COALESCE(item.data ->> 'rarity', '0') = '0'
  AND (item.data -> 'cost' ->> 'value') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.data -> 'cost' ->> 'value')::numeric > 0
  AND EXISTS (
      SELECT 1
      FROM dndshare.item_content_source link
      JOIN dndshare.content_source content ON content.id = link.content_source_id
      JOIN dndshare.source_version version ON version.id = content.native_source_version_id
      WHERE link.item_id = item.id AND upper(content.code) = 'PHB' AND version.version = '2014'
  );

-- The book gives bundle contents rather than total weights. Store the sum of
-- components with a listed weight, so every purchasable inventory row is usable.
UPDATE dndshare.item item
SET data = jsonb_set(item.data, '{weight}', to_jsonb(seed.weight), true)
FROM (VALUES
    ('Набор артиста', 38::numeric),
    ('Набор взломщика', 47.5),
    ('Набор дипломата', 36),
    ('Набор исследователя подземелий', 61.5),
    ('Набор путешественника', 59),
    ('Набор священника', 18),
    ('Набор учёного', 10)
) AS seed(name, weight)
WHERE item.user_id IS NULL AND item.type_id = 2 AND item.name = seed.name;

-- Every priced PHB weapon except the zero-cost unarmed strike is purchasable.
UPDATE dndshare.item item
SET data = item.data || jsonb_build_object(
    'available_in_starting_shop', true,
    'weight', CASE
        WHEN (
            lower(COALESCE(item.name_en, '')) = 'sling' OR lower(item.name) = 'праща'
        ) AND item.data ->> 'weight' IS NULL THEN to_jsonb(0)
        ELSE item.data -> 'weight'
    END,
    'notes', CASE
        WHEN btrim(regexp_replace(COALESCE(item.data ->> 'notes', ''), '<[^>]*>', '', 'g')) <> ''
            THEN item.data ->> 'notes'
        ELSE CASE lower(item.name)
            WHEN 'алебарда' THEN '<p>Тяжёлое древковое оружие с большой досягаемостью.</p>'
            WHEN 'глефа' THEN '<p>Тяжёлое древковое оружие с режущим клинком и большой досягаемостью.</p>'
            WHEN 'кнут' THEN '<p>Лёгкое фехтовальное оружие с увеличенной досягаемостью.</p>'
            WHEN 'молот' THEN '<p>Тяжёлое двуручное дробящее оружие.</p>'
            WHEN 'секира' THEN '<p>Тяжёлое двуручное рубящее оружие.</p>'
            WHEN 'скимитар' THEN '<p>Лёгкое фехтовальное оружие с изогнутым клинком.</p>'
            WHEN 'цеп' THEN '<p>Воинское дробящее оружие с шарнирным ударным звеном.</p>'
            ELSE '<p>' || item.name || ' — оружие из Книги игрока (2014).</p>'
        END
    END
)
WHERE item.user_id IS NULL
  AND item.type_id = 1
  AND (item.data -> 'cost' ->> 'value') ~ '^[0-9]+([.][0-9]+)?$'
  AND (item.data -> 'cost' ->> 'value')::numeric > 0
  AND EXISTS (
      SELECT 1
      FROM dndshare.item_content_source link
      JOIN dndshare.content_source content ON content.id = link.content_source_id
      JOIN dndshare.source_version version ON version.id = content.native_source_version_id
      WHERE link.item_id = item.id AND upper(content.code) = 'PHB' AND version.version = '2014'
  );

-- The common healing potion appears in the adventuring-gear price table even
-- though it lives in the dedicated potion catalogue.
UPDATE dndshare.item item
SET data = item.data || jsonb_build_object(
    'cost', jsonb_build_object('value', 50, 'suggest_id', 3),
    'weight', 0.5,
    'available_in_starting_shop', true
)
WHERE item.user_id IS NULL
  AND item.type_id = 10
  AND lower(COALESCE(item.name_en, '')) = 'potion of healing'
  AND COALESCE(item.data ->> 'rarity', '0') = '0'
  AND EXISTS (
      SELECT 1
      FROM dndshare.item_content_source link
      JOIN dndshare.content_source content ON content.id = link.content_source_id
      JOIN dndshare.source_version version ON version.id = content.native_source_version_id
      WHERE link.item_id = item.id AND upper(content.code) = 'PHB' AND version.version = '2014'
  );

-- Attach all newly seeded records to the 2014 PHB. Existing relations are kept.
WITH phb AS (
    SELECT content.id
    FROM dndshare.content_source content
    JOIN dndshare.source_version version ON version.id = content.native_source_version_id
    JOIN dndshare."source" source ON source.id = content.source_id
    WHERE upper(content.code) = 'PHB' AND version.version = '2014'
      AND lower(source.name) = 'dnd5e'
    ORDER BY content.id
    LIMIT 1
), seeded AS (
    SELECT item.id, CASE item.type_id WHEN 12 THEN 145 WHEN 13 THEN 157 ELSE 154 END AS page
    FROM dndshare.item item
    WHERE item.user_id IS NULL AND (
        item.type_id IN (12, 13)
        OR (item.type_id = 2 AND EXISTS (
            SELECT 1 FROM starting_shop_tools tool
            WHERE lower(tool.name_en) = lower(COALESCE(item.name_en, ''))
        ))
    )
)
INSERT INTO dndshare.item_content_source (item_id, content_source_id, page, primary_source)
SELECT seeded.id, phb.id, seeded.page, true
FROM seeded CROSS JOIN phb
ON CONFLICT (item_id, content_source_id) DO UPDATE SET
    page = COALESCE(dndshare.item_content_source.page, EXCLUDED.page),
    primary_source = dndshare.item_content_source.primary_source OR EXCLUDED.primary_source;

UPDATE dndshare.item_type item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id IN (1, 2, 10, 12, 13);

SELECT setval(
    pg_get_serial_sequence('dndshare.item_type', 'id'),
    GREATEST((SELECT MAX(id) FROM dndshare.item_type), 1)
);
