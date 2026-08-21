-- A physical tool and proficiency with it are independent character facts.
-- Handbook tools point to suggest type 5 so rules and UI can resolve the
-- concrete proficiency and, where it exists, the broader category. Multiple
-- ids use OR semantics, matching the weapon proficiency contract.

WITH proficiency_seed(code, value, description) AS (
    VALUES
        ('tool-artisan-alchemist', 'Инструменты алхимика', 'Владение ремесленными инструментами алхимика.'),
        ('tool-artisan-potter', 'Инструменты гончара', 'Владение ремесленными инструментами гончара.'),
        ('tool-artisan-tinker', 'Инструменты жестянщика', 'Владение ремесленными инструментами жестянщика.'),
        ('tool-artisan-calligrapher', 'Инструменты каллиграфа', 'Владение ремесленными инструментами каллиграфа.'),
        ('tool-artisan-cartographer', 'Инструменты картографа', 'Владение ремесленными инструментами картографа.'),
        ('tool-artisan-leatherworker', 'Инструменты кожевника', 'Владение ремесленными инструментами кожевника.'),
        ('tool-artisan-carpenter', 'Инструменты плотника', 'Владение ремесленными инструментами плотника.'),
        ('tool-artisan-cook', 'Инструменты повара', 'Владение ремесленными инструментами повара.'),
        ('tool-artisan-cobbler', 'Инструменты сапожника', 'Владение ремесленными инструментами сапожника.'),
        ('tool-artisan-glassblower', 'Инструменты стеклодува', 'Владение ремесленными инструментами стеклодува.'),
        ('tool-artisan-weaver', 'Инструменты ткача', 'Владение ремесленными инструментами ткача.'),
        ('tool-artisan-painter', 'Инструменты художника', 'Владение ремесленными инструментами художника.'),
        ('tool-artisan-jeweler', 'Инструменты ювелира', 'Владение ремесленными инструментами ювелира.'),
        ('tool-game-dragonchess', 'Драконьи шахматы', 'Владение набором для игры в драконьи шахматы.'),
        ('tool-game-cards', 'Карты', 'Владение набором игральных карт.'),
        ('tool-game-dice', 'Кости', 'Владение набором игральных костей.'),
        ('tool-game-three-dragon-ante', 'Ставка трёх драконов', 'Владение набором для игры «Ставка трёх драконов».'),
        ('tool-music-drum', 'Барабаны', 'Владение барабанами.'),
        ('tool-music-viol', 'Виола', 'Владение виолой.'),
        ('tool-music-bagpipes', 'Волынка', 'Владение волынкой.'),
        ('tool-music-lyre', 'Лира', 'Владение лирой.'),
        ('tool-music-lute', 'Лютня', 'Владение лютней.'),
        ('tool-music-horn', 'Рожок', 'Владение рожком.'),
        ('tool-music-pan-flute', 'Свирель', 'Владение свирелью.'),
        ('tool-music-flute', 'Флейта', 'Владение флейтой.'),
        ('tool-music-dulcimer', 'Цимбалы', 'Владение цимбалами.'),
        ('tool-music-shawm', 'Шалмей', 'Владение шалмеем.')
)
INSERT INTO dndshare.suggest (type_id, value, code, "desc")
SELECT 5, seed.value, seed.code, seed.description
FROM proficiency_seed seed
WHERE NOT EXISTS (
    SELECT 1
    FROM dndshare.suggest current
    WHERE current.type_id = 5
      AND current.user_id IS NULL
      AND lower(btrim(current.value)) = lower(seed.value)
);

-- This background entry is equipment for a confidence trick, not a PHB tool
-- proficiency. Keep it among ordinary Things even on databases where section
-- 30 previously classified every `equipment_category=tool` row as a Tool.
UPDATE dndshare.item
SET type_id = 2,
    data = (data - 'category' - 'required_tool_proficiencies')
        || jsonb_build_object('equipment_category', 'gear')
WHERE user_id IS NULL
  AND lower(COALESCE(name_en, '')) = 'background con tools choice';

WITH requirement(name_en, category, specific_value, broad_value) AS (
    VALUES
        ('Thieves'' Tools', 'kit', 'Воровские инструменты', NULL::varchar),
        ('Navigator''s Tools', 'kit', 'Инструменты навигатора', NULL),
        ('Poisoner''s Kit', 'kit', 'Инструменты отравителя', NULL),
        ('Disguise Kit', 'kit', 'Набор для грима', NULL),
        ('Forgery Kit', 'kit', 'Набор для фальсификации', NULL),
        ('Herbalism Kit', 'kit', 'Набор травника', NULL),

        ('Dragonchess Set', 'gaming', 'Драконьи шахматы', 'Игровой набор'),
        ('Playing Card Set', 'gaming', 'Карты', 'Игровой набор'),
        ('Dice Set', 'gaming', 'Кости', 'Игровой набор'),
        ('Three-Dragon Ante Set', 'gaming', 'Ставка трёх драконов', 'Игровой набор'),
        ('Background Gaming Set Choice', 'gaming', NULL, 'Игровой набор'),

        ('Alchemist''s Supplies', 'artisan', 'Инструменты алхимика', 'Инструменты ремесленников'),
        ('Potter''s Tools', 'artisan', 'Инструменты гончара', 'Инструменты ремесленников'),
        ('Tinker''s Tools', 'artisan', 'Инструменты жестянщика', 'Инструменты ремесленников'),
        ('Calligrapher''s Supplies', 'artisan', 'Инструменты каллиграфа', 'Инструменты ремесленников'),
        ('Mason''s Tools', 'artisan', 'Инструменты каменщика', 'Инструменты ремесленников'),
        ('Cartographer''s Tools', 'artisan', 'Инструменты картографа', 'Инструменты ремесленников'),
        ('Leatherworker''s Tools', 'artisan', 'Инструменты кожевника', 'Инструменты ремесленников'),
        ('Smith''s Tools', 'artisan', 'Инструменты кузнеца', 'Инструменты ремесленников'),
        ('Brewer''s Supplies', 'artisan', 'Инструменты пивовара', 'Инструменты ремесленников'),
        ('Carpenter''s Tools', 'artisan', 'Инструменты плотника', 'Инструменты ремесленников'),
        ('Cook''s Utensils', 'artisan', 'Инструменты повара', 'Инструменты ремесленников'),
        ('Woodcarver''s Tools', 'artisan', 'Резчицкие инструменты', 'Инструменты ремесленников'),
        ('Cobbler''s Tools', 'artisan', 'Инструменты сапожника', 'Инструменты ремесленников'),
        ('Glassblower''s Tools', 'artisan', 'Инструменты стеклодува', 'Инструменты ремесленников'),
        ('Weaver''s Tools', 'artisan', 'Инструменты ткача', 'Инструменты ремесленников'),
        ('Painter''s Supplies', 'artisan', 'Инструменты художника', 'Инструменты ремесленников'),
        ('Jeweler''s Tools', 'artisan', 'Инструменты ювелира', 'Инструменты ремесленников'),
        ('Background Artisan Tools Choice', 'artisan', NULL, 'Инструменты ремесленников'),

        ('Drum', 'musical', 'Барабаны', 'Музыкальные инструменты'),
        ('Viol', 'musical', 'Виола', 'Музыкальные инструменты'),
        ('Bagpipes', 'musical', 'Волынка', 'Музыкальные инструменты'),
        ('Lyre', 'musical', 'Лира', 'Музыкальные инструменты'),
        ('Lute', 'musical', 'Лютня', 'Музыкальные инструменты'),
        ('Horn', 'musical', 'Рожок', 'Музыкальные инструменты'),
        ('Pan Flute', 'musical', 'Свирель', 'Музыкальные инструменты'),
        ('Flute', 'musical', 'Флейта', 'Музыкальные инструменты'),
        ('Dulcimer', 'musical', 'Цимбалы', 'Музыкальные инструменты'),
        ('Shawm', 'musical', 'Шалмей', 'Музыкальные инструменты'),
        ('Background Musical Instrument Choice', 'musical', NULL, 'Музыкальные инструменты')
), resolved AS (
    SELECT
        item.id,
        requirement.category,
        array_remove(ARRAY[specific.id, broad.id], NULL::bigint) AS proficiency_ids
    FROM requirement
    JOIN dndshare.item item
      ON item.user_id IS NULL
     AND item.type_id = 14
     AND lower(COALESCE(item.name_en, '')) = lower(requirement.name_en)
    LEFT JOIN dndshare.suggest specific
      ON specific.type_id = 5
     AND specific.user_id IS NULL
     AND lower(btrim(specific.value)) = lower(requirement.specific_value)
    LEFT JOIN dndshare.suggest broad
      ON broad.type_id = 5
     AND broad.user_id IS NULL
     AND lower(btrim(broad.value)) = lower(requirement.broad_value)
)
UPDATE dndshare.item item
SET data = jsonb_set(
    jsonb_set(item.data, '{category}', to_jsonb(resolved.category), true),
    '{required_tool_proficiencies}',
    to_jsonb(resolved.proficiency_ids),
    true
)
FROM resolved
WHERE item.id = resolved.id;

UPDATE dndshare.suggest_type
SET count_items = (SELECT COUNT(*) FROM dndshare.suggest WHERE type_id = 5)
WHERE id = 5;

UPDATE dndshare.item_type item_type
SET count_items = (
    SELECT COUNT(*) FROM dndshare.item item
    WHERE item.type_id = item_type.id AND item.user_id IS NULL
)
WHERE item_type.id IN (2, 14);
