
-- ---------------------------------------------------------------------------
-- v3+ seed data (charcreate migrations): item types Черты(7)/Расы(8)/Классы(9)/Зелья(10),
-- suggest type Редкость(23) + значения. ON CONFLICT DO NOTHING → no-op на проде.
-- ---------------------------------------------------------------------------
INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (7, 'Черты', '[]'::jsonb, (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1), '#d6a84f', true, 'Особые таланты и обучение персонажей: требования, выборы, бонусы и ограниченные использования.')
ON CONFLICT (id) DO NOTHING;

-- v5 (2026-08-09): структурированная модель черт. Старый тип 7 исторически жил
-- только на проде; добавляем отсутствующие поля по ключу, не затирая возможные
-- дополнительные поля и сами данные существующих черт.
WITH wanted(fields) AS (
    VALUES ('[{"name":"Описание","key":"description","type":"description"},{"name":"Требования","key":"prereq","type":"object","fields":[{"name":"Текст требования","key":"text","type":"text"},{"name":"Минимальные характеристики","key":"min_stats","type":"object_array","fields":[{"name":"Характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Минимум","key":"value","type":"int","default":13}]},{"name":"Связь характеристик","key":"min_stats_mode","type":"select","default":"all","options":[{"value":"all","label":"Все условия (И)"},{"value":"any","label":"Любое условие (ИЛИ)"}]},{"name":"Требуется заклинательство","key":"spellcasting","type":"bool"},{"name":"Требуемое владение доспехами","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Минимальный уровень","key":"min_level","type":"int"}]},{"name":"Можно брать повторно","key":"repeatable","type":"bool","default":false,"filter":true},{"name":"Уникальный выбор при повторе","key":"unique_choice_key","type":"text","show_on":{"key":"repeatable","value":true}},{"name":"Выборы при получении","key":"choices","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Подсказка игроку","key":"text","type":"text"},{"name":"Сколько выбрать","key":"count","type":"int","default":1},{"name":"Источник вариантов","key":"source","type":"select","default":"inline","options":[{"value":"inline","label":"Варианты ниже"},{"value":"suggest","label":"Словарь"},{"value":"item","label":"Предметы справочника"}]},{"name":"ID словаря","key":"from_suggest_id","type":"int","show_on":{"key":"source","value":"suggest"}},{"name":"ID типа предметов","key":"from_item_type_id","type":"int","show_on":{"key":"source","value":"item"}},{"name":"Фильтр предметов","key":"item_filter","type":"text","show_on":{"key":"source","value":"item"}},{"name":"Не повторять вариант","key":"unique_across_takes","type":"bool"},{"name":"Варианты","key":"options","type":"object_array","show_on":{"key":"source","value":"inline"},"fields":[{"name":"Значение","key":"value","type":"text"},{"name":"Название","key":"label","type":"text"},{"name":"Описание","key":"desc","type":"text"}]}]},{"name":"Фиксированные бонусы характеристик","key":"asi","type":"object_array","fields":[{"name":"Характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Бонус","key":"bonus","type":"int","default":1}]},{"name":"Бонус характеристики на выбор","key":"asi_choice","type":"object","fields":[{"name":"Ключ выбора","key":"choice_key","type":"text","default":"ability"},{"name":"Сколько выбрать","key":"count","type":"int","default":1},{"name":"Бонус","key":"bonus","type":"int","default":1},{"name":"Доступные характеристики","key":"from","type":"suggest_array","suggest_id":16}]},{"name":"Даруемые владения","key":"grants","type":"object","fields":[{"name":"Доспехи","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Оружие","key":"weapon_prof","type":"suggest_array","suggest_id":4},{"name":"Инструменты","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Навыки","key":"skill_prof","type":"suggest_array","suggest_id":15},{"name":"Спасброски","key":"save_prof","type":"suggest_array","suggest_id":16},{"name":"Языки","key":"languages","type":"suggest_array","suggest_id":6}]},{"name":"Максимум использований","key":"max_use","type":"int"},{"name":"Редактируемый максимум","key":"manual_size","type":"bool"},{"name":"Восстановление на коротком отдыхе","key":"rollback_short_rest","type":"bool"},{"name":"Восстановление на длинном отдыхе","key":"rollback_long_rest","type":"bool"},{"name":"Теги","key":"tags","type":"text"},{"name":"Страница источника","key":"source_page","type":"int"}]'::jsonb)
), missing AS (
    SELECT it.id, jsonb_agg(candidate.field ORDER BY candidate.ord) AS fields
    FROM dndshare.item_type it
    CROSS JOIN wanted
    CROSS JOIN LATERAL jsonb_array_elements(wanted.fields) WITH ORDINALITY AS candidate(field, ord)
    WHERE it.id = 7
      AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(COALESCE(it.fields, '[]'::jsonb)) current
          WHERE current->>'key' = candidate.field->>'key'
      )
    GROUP BY it.id
)
UPDATE dndshare.item_type it
SET fields = COALESCE(it.fields, '[]'::jsonb) || missing.fields,
    color = COALESCE(it.color, '#d6a84f'),
    description = COALESCE(it.description, 'Особые таланты и обучение персонажей: требования, выборы, бонусы и ограниченные использования.')
FROM missing
WHERE it.id = missing.id;

-- Choice-driven grants (e.g. Resilient: the selected ability gets both +1 and
-- saving-throw proficiency) are nested inside the `choices` field, so extend
-- that field separately while preserving any custom choice subfields.
WITH additions(fields) AS (
    VALUES ('[{"name":"Бонус выбранной характеристики","key":"ability_bonus","type":"int"},{"name":"Даруемое владение","key":"grant_proficiency","type":"select","options":[{"value":"","label":"Не применять"},{"value":"armor_prof","label":"Доспех"},{"value":"weapon_prof","label":"Оружие"},{"value":"tool_prof","label":"Инструмент"},{"value":"skill_prof","label":"Навык"},{"value":"save_prof","label":"Спасбросок"},{"value":"languages","label":"Язык"}]},{"name":"Добавить выбранные заклинания","key":"grant_spells","type":"bool"}]'::jsonb)
)
UPDATE dndshare.item_type it
SET fields = (
    SELECT jsonb_agg(
        CASE WHEN field->>'key' = 'choices'
            THEN jsonb_set(field, '{fields}', COALESCE(field->'fields', '[]'::jsonb) || additions.fields)
            ELSE field
        END
        ORDER BY ord
    )
    FROM jsonb_array_elements(it.fields) WITH ORDINALITY AS row_field(field, ord)
    CROSS JOIN additions
)
WHERE it.id = 7
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(it.fields) field WHERE field->>'key' = 'choices')
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(it.fields) field
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field->'fields', '[]'::jsonb)) subfield
      WHERE field->>'key' = 'choices' AND subfield->>'key' = 'ability_bonus'
  );

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (8, 'Расы', '[{"name":"Раса (словарь)","key":"suggest_id","type":"suggest","suggest_id":1},{"name":"Размер","key":"size","type":"text"},{"name":"Скорость","key":"speed","type":"int","default":30},{"name":"Бонусы характеристик","key":"asi","type":"object_array","fields":[{"name":"Характеристика","key":"ability","type":"suggest","suggest_id":16},{"name":"Бонус","key":"bonus","type":"int","default":1}]},{"name":"Плавающий бонус (выбор)","key":"asi_choice","type":"object","fields":[{"name":"Сколько выбрать","key":"count","type":"int","default":2},{"name":"Бонус","key":"bonus","type":"int","default":1}]},{"name":"Выбор навыков","key":"skill_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":2},{"name":"Из навыков (пусто = любые)","key":"from","type":"suggest_array","suggest_id":15}]},{"name":"Выбор языка","key":"lang_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":1},{"name":"Из языков (пусто = любые)","key":"from","type":"suggest_array","suggest_id":6}]},{"name":"Языки","key":"languages","type":"suggest_array","suggest_id":6},{"name":"Владение доспехами","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Владение оружием","key":"weapon_prof","type":"suggest_array","suggest_id":4},{"name":"Владение инструментами","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Описание","key":"description","type":"description"}]'::jsonb, (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1), '#5aaf72', true, 'Расы и подрасы персонажей: бонусы характеристик, скорость, размер, языки, владения.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (9, 'Классы', '[{"name":"Класс (словарь)","key":"suggest_id","type":"suggest","suggest_id":2},{"name":"Кость хитов","key":"hit_die","type":"suggest","suggest_id":11},{"name":"Основные характеристики","key":"primary_abilities","type":"suggest_array","suggest_id":16},{"name":"Спасброски","key":"saves","type":"suggest_array","suggest_id":16},{"name":"Владение доспехами","key":"armor_prof","type":"suggest_array","suggest_id":3},{"name":"Владение оружием","key":"weapon_prof","type":"suggest_array","suggest_id":4},{"name":"Владение инструментами","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Выбор навыков","key":"skill_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":2},{"name":"Из навыков","key":"from","type":"suggest_array","suggest_id":15}]},{"name":"Заклинательство","key":"spellcasting","type":"object","fields":[{"name":"Характеристика заклинаний","key":"ability","type":"suggest","suggest_id":16},{"name":"Заговоров на 1 уровне","key":"cantrips_known","type":"int"},{"name":"Заклинаний на 1 уровне","key":"spells_known","type":"int"},{"name":"Подготавливает заклинания","key":"prepares","type":"bool"},{"name":"Примечание","key":"note","type":"description"}]},{"name":"Уровень выбора архетипа","key":"subclass_level","type":"int"},{"name":"Уровни прироста характеристик (ASI)","key":"asi_levels","type":"text"},{"name":"Даруемые заклинания","key":"granted_spells","type":"object_array","fields":[{"name":"Уровень класса","key":"level","type":"int","default":1},{"name":"Заклинание","key":"spell","type":"item","item_type":5},{"name":"Вариант (напр. местность)","key":"option","type":"text"}]},{"name":"Стартовое снаряжение","key":"starting_equipment","type":"description"},{"name":"Описание","key":"description","type":"description"}]'::jsonb, (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1), '#7c5cff', true, 'Классы и архетипы персонажей: кость хитов, владения, заклинательство, выбор навыков.')
ON CONFLICT (id) DO NOTHING;

-- v4 (2026-07-19): «Даруемые заклинания» (granted_spells) у типа 9 — заклинания
-- домена/клятвы/круга на архетипах. INSERT выше на проде no-op, поэтому дописываем
-- поле существующему типу идемпотентным UPDATE (только если его ещё нет).
UPDATE dndshare.item_type
SET fields = fields || '[{"name":"Даруемые заклинания","key":"granted_spells","type":"object_array","fields":[{"name":"Уровень класса","key":"level","type":"int","default":1},{"name":"Заклинание","key":"spell","type":"item","item_type":5},{"name":"Вариант (напр. местность)","key":"option","type":"text"}]}]'::jsonb
WHERE id = 9
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key' = 'granted_spells');

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (10, 'Зелья', '[{"name":"Описание","key":"desc","type":"description"},{"name":"Цвет зелья","key":"color","type":"color","default":"#7c5cff"},{"name":"Редкость","key":"rarity","type":"suggest","suggest_id":23,"filter":true},{"name":"Стоимость","key":"cost","type":"int_by_suggest","suggest_type_id":17},{"name":"Вес","key":"weight","type":"int"}]'::jsonb, (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1), '#3fb6a8', false, 'Зелья и эликсиры: расходуемые предметы, отображаются колбами в инвентаре персонажа.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (11, 'Предыстории', '[{"name":"Владение навыками","key":"skills","type":"suggest_array","suggest_id":15},{"name":"Языки","key":"languages","type":"suggest_array","suggest_id":6},{"name":"Языки на выбор","key":"lang_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":1}]},{"name":"Владение инструментами","key":"tool_prof","type":"suggest_array","suggest_id":5},{"name":"Черта предыстории","key":"feature","type":"text"},{"name":"Описание черты","key":"feature_desc","type":"description"},{"name":"Стартовое снаряжение","key":"equipment","type":"description"},{"name":"Описание","key":"description","type":"description"}]'::jsonb, (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1), '#c98a3a', true, 'Предыстории персонажей: владение навыками, инструменты, языки, черта предыстории и стартовое снаряжение.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.suggest_type (id, name, source_id, color, count_items)
VALUES (23, 'Редкость', (SELECT id FROM dndshare."source" WHERE lower(name) = 'dnd5e' LIMIT 1), '#caa8ff', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO dndshare.suggest (id, type_id, value, color, code) VALUES
    (0, 23, 'Обычное',      '#9aa0ad', 'common'),
    (1, 23, 'Необычное',    '#4fae6a', 'uncommon'),
    (2, 23, 'Редкое',       '#4f8fe0', 'rare'),
    (3, 23, 'Очень редкое', '#a26cf0', 'very_rare'),
    (4, 23, 'Легендарное',  '#f0b03c', 'legendary'),
    (5, 23, 'Артефакт',     '#e0524e', 'artifact')
ON CONFLICT (type_id, id) DO NOTHING;

-- Сиды вставляют явные id в bigserial-колонки — двигаем последовательности за максимум,
-- иначе nextval рано или поздно выдаст занятый id и вставка упадёт (23505). setval до MAX(id)
-- идемпотентен и безопасен на проде (последовательность уже не ниже максимума).
SELECT setval(pg_get_serial_sequence('dndshare.item_type', 'id'), GREATEST((SELECT MAX(id) FROM dndshare.item_type), 1));
SELECT setval(pg_get_serial_sequence('dndshare.suggest_type', 'id'), GREATEST((SELECT MAX(id) FROM dndshare.suggest_type), 1));
