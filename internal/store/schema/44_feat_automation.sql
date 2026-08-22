-- PHB 2014 feats are source-driven character features. Requirements, choices,
-- grants and passive rules live in item data; runtime code never branches on a
-- feat name.

-- Extend the editor contract for dependent spell choices and source-owned
-- proficiency grants.
WITH rewritten AS (
  SELECT item_type.id, jsonb_agg(
    CASE WHEN field.value ->> 'key' = 'choices' THEN
      jsonb_set(field.value, '{fields}', (
        SELECT jsonb_agg(
          CASE WHEN nested.value ->> 'key' = 'source' THEN
            jsonb_set(nested.value, '{options}', COALESCE(nested.value -> 'options', '[]'::jsonb)
              || '[{"value":"suggest_union","label":"Несколько словарей"}]'::jsonb, true)
          WHEN nested.value ->> 'key' = 'options' THEN
            jsonb_set(nested.value, '{fields}', COALESCE(nested.value -> 'fields', '[]'::jsonb)
              || '[{"name":"Заклинательная характеристика","key":"casting_ability","type":"suggest","suggest_id":16}]'::jsonb, true)
          ELSE nested.value END ORDER BY nested.ordinal
        ) FROM jsonb_array_elements(field.value -> 'fields') WITH ORDINALITY nested(value, ordinal)
      ) || '[
        {"name":"Зависит от выбора","key":"depends_on_choice","type":"text"},
        {"name":"Объединённые словари","key":"suggest_sources","type":"object_array","fields":[{"name":"ID словаря","key":"suggest_id","type":"int"},{"name":"Префикс","key":"prefix","type":"text"},{"name":"Название группы","key":"label","type":"text"}]},
        {"name":"Динамический фильтр","key":"item_filter_from_choice","type":"object","fields":[{"name":"Ключ выбора","key":"choice_key","type":"text"},{"name":"Путь поля","key":"path","type":"text"}]},
        {"name":"Характеристика из выбора","key":"casting_ability_choice_key","type":"text"},
        {"name":"Характеристика заклинаний","key":"casting_ability","type":"suggest","suggest_id":16},
        {"name":"Без расхода ячейки","key":"slotless","type":"bool"},
        {"name":"Уровень сотворения","key":"cast_level","type":"int"}
      ]'::jsonb, true)
    WHEN field.value ->> 'key' = 'derived_effects' THEN
      jsonb_set(jsonb_set(field.value, '{fields}', COALESCE(field.value -> 'fields', '[]'::jsonb)
        || '[{"name":"Цели","key":"target_ids","type":"text_array"},{"name":"Префикс значения выбора","key":"choice_value_prefix","type":"text"}]'::jsonb, true), '{fields,0,options}',
        COALESCE(field.value #> '{fields,0,options}', '[]'::jsonb) || '[{"value":"armor_proficiency","label":"Владение доспехом"},{"value":"weapon_proficiency","label":"Владение оружием"},{"value":"tool_proficiency","label":"Владение инструментом"},{"value":"language_proficiency","label":"Владение языком"}]'::jsonb, true)
    ELSE field.value END ORDER BY field.ordinal
  ) AS fields
  FROM dndshare.item_type item_type
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY field(value, ordinal)
  WHERE item_type.id = 7
  GROUP BY item_type.id
)
UPDATE dndshare.item_type target SET fields = rewritten.fields
FROM rewritten WHERE target.id = rewritten.id
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(target.fields) choice_field,
      jsonb_array_elements(CASE WHEN choice_field ->> 'key' = 'choices' THEN choice_field -> 'fields' ELSE '[]'::jsonb END) nested
    WHERE nested ->> 'key' = 'depends_on_choice'
  );

-- Two PHB feats were absent from the imported catalogue.
WITH feat_seed(name_ru, name_en, data) AS (
  VALUES
    ('Лекарь', 'Healer', '{"description":"<p>Вы умеете быстро возвращать союзников в бой при помощи набора лекаря. Стабилизация восстанавливает 1 хит; один раз между отдыхами существо можно вылечить на 1к6 + 4 + его максимум костей хитов.</p>","source_page":167}'::jsonb),
    ('Скрытный', 'Skulker', '{"description":"<p>Вы умеете скрываться в плохой видимости, не выдаёте позицию промахом из дальнобойного оружия и не получаете помеху к проверкам Мудрости (Внимательность) из-за тусклого света.</p>","source_page":170}'::jsonb)
)
INSERT INTO dndshare.item (name, name_en, type_id, data)
SELECT name_ru, name_en, 7, data FROM feat_seed
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item current
  WHERE current.type_id = 7 AND current.user_id IS NULL AND lower(current.name) = lower(feat_seed.name_ru)
);

WITH phb AS (
  SELECT content.id FROM dndshare.content_source content
  JOIN dndshare."source" source ON source.id = content.source_id
  WHERE lower(source.name) = 'dnd5e' AND upper(content.code) = 'PHB'
  ORDER BY content.id LIMIT 1
), feats AS (
  SELECT id FROM dndshare.item WHERE type_id = 7 AND user_id IS NULL
)
INSERT INTO dndshare.item_content_source (item_id, content_source_id, primary_source)
SELECT feats.id, phb.id, true FROM feats CROSS JOIN phb
ON CONFLICT (item_id, content_source_id) DO NOTHING;

-- Verifiable prerequisites. Free-form prerequisite text remains explanatory;
-- only these structured fields can disable feat effects.
WITH rules(name_ru, prereq) AS (
  VALUES
    ('Дуэлянт', '{"min_stats":[{"ability":2,"value":13}]}'::jsonb),
    ('Адепт стихий', '{"spellcasting":true}'::jsonb),
    ('Борец', '{"min_stats":[{"ability":1,"value":13}]}'::jsonb),
    ('Вдохновляющий лидер', '{"min_stats":[{"ability":6,"value":13}]}'::jsonb),
    ('Ритуальный заклинатель', '{"min_stats":[{"ability":4,"value":13},{"ability":5,"value":13}],"min_stats_mode":"any"}'::jsonb),
    ('Снайпер заклинаний', '{"spellcasting":true}'::jsonb),
    ('Заклинатель в бою', '{"spellcasting":true}'::jsonb),
    ('Тяжело бронированный', '{"armor_prof":[13]}'::jsonb),
    ('Мастер тяжёлых доспехов', '{"armor_prof":[16]}'::jsonb),
    ('Мастер средних доспехов', '{"armor_prof":[13]}'::jsonb),
    ('Умеренно бронированный', '{"armor_prof":[9]}'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{prereq}', rules.prereq, true)
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

-- Fixed ability-score increases.
WITH rules(name_ru, asi) AS (
  VALUES
    ('Актёр', '[{"ability":6,"bonus":1}]'::jsonb),
    ('Выносливый', '[{"ability":3,"bonus":1}]'::jsonb),
    ('Тяжело бронированный', '[{"ability":1,"bonus":1}]'::jsonb),
    ('Мастер тяжёлых доспехов', '[{"ability":1,"bonus":1}]'::jsonb),
    ('Острый ум', '[{"ability":4,"bonus":1}]'::jsonb),
    ('Лингвист', '[{"ability":4,"bonus":1}]'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{asi}', rules.asi, true)
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

-- Ability choices use the same picker and bonus contract as all other feature
-- choices; the chosen value is stored with the feat entry.
WITH rules(name_ru, choices) AS (
  VALUES
    ('Атлет', '[{"key":"ability","text":"Увеличьте Силу или Ловкость на 1","count":1,"source":"inline","ability_bonus":1,"options":[{"value":1,"label":"Сила"},{"value":2,"label":"Ловкость"}]}]'::jsonb),
    ('Легко бронированный', '[{"key":"ability","text":"Увеличьте Силу или Ловкость на 1","count":1,"source":"inline","ability_bonus":1,"options":[{"value":1,"label":"Сила"},{"value":2,"label":"Ловкость"}]}]'::jsonb),
    ('Умеренно бронированный', '[{"key":"ability","text":"Увеличьте Силу или Ловкость на 1","count":1,"source":"inline","ability_bonus":1,"options":[{"value":1,"label":"Сила"},{"value":2,"label":"Ловкость"}]}]'::jsonb),
    ('Наблюдательный', '[{"key":"ability","text":"Увеличьте Интеллект или Мудрость на 1","count":1,"source":"inline","ability_bonus":1,"options":[{"value":4,"label":"Интеллект"},{"value":5,"label":"Мудрость"}]}]'::jsonb),
    ('Трактирный буян', '[{"key":"ability","text":"Увеличьте Силу или Телосложение на 1","count":1,"source":"inline","ability_bonus":1,"options":[{"value":1,"label":"Сила"},{"value":3,"label":"Телосложение"}]}]'::jsonb),
    ('Мастер оружия', '[{"key":"ability","text":"Увеличьте Силу или Ловкость на 1","count":1,"source":"inline","ability_bonus":1,"options":[{"value":1,"label":"Сила"},{"value":2,"label":"Ловкость"}]},{"key":"weapons","text":"Выберите четыре вида оружия","count":4,"source":"suggest","from_suggest_id":4}]'::jsonb),
    ('Стойкий', '[{"key":"ability","text":"Выберите характеристику: она увеличится на 1, а спасбросок получит владение","count":1,"source":"suggest","from_suggest_id":16,"ability_bonus":1}]'::jsonb),
    ('Лингвист', '[{"key":"languages","text":"Выберите три языка","count":3,"source":"suggest","from_suggest_id":6}]'::jsonb),
    ('Знаток', '[{"key":"proficiencies","text":"Выберите любые три навыка или инструмента","count":3,"source":"suggest_union","suggest_sources":[{"suggest_id":15,"prefix":"skill","label":"Навык"},{"suggest_id":5,"prefix":"tool","label":"Инструмент"}]}]'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{choices}', rules.choices, true)
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

-- Spell-list feats: the class choice fixes both the locked handbook filter and
-- the casting ability. A dependent spell picker cannot open before the class
-- has been selected.
WITH class_options AS (
  SELECT '[{"value":4016,"label":"Бард","casting_ability":6},{"value":4014,"label":"Волшебник","casting_ability":4},{"value":4019,"label":"Друид","casting_ability":5},{"value":4020,"label":"Жрец","casting_ability":5},{"value":4018,"label":"Колдун","casting_ability":6},{"value":4017,"label":"Чародей","casting_ability":6}]'::jsonb AS options
), rules(name_ru, choices) AS (
  SELECT 'Посвящённый в магию', jsonb_build_array(
    jsonb_build_object('key','magic_class','text','Выберите класс, список заклинаний и характеристику','count',1,'source','inline','options',options),
    '{"key":"cantrips","text":"Выберите два заговора этого класса","count":2,"source":"item","from_item_type_id":5,"item_filter":{"lvl":0},"depends_on_choice":"magic_class","item_filter_from_choice":{"choice_key":"magic_class","path":"classes.id"},"grant_spells":true,"casting_ability_choice_key":"magic_class"}'::jsonb,
    '{"key":"spell","text":"Выберите одно заклинание 1 уровня этого класса","count":1,"source":"item","from_item_type_id":5,"item_filter":{"lvl":1},"depends_on_choice":"magic_class","item_filter_from_choice":{"choice_key":"magic_class","path":"classes.id"},"grant_spells":true,"casting_ability_choice_key":"magic_class","slotless":true,"cast_level":1}'::jsonb
  ) FROM class_options
  UNION ALL
  SELECT 'Снайпер заклинаний', jsonb_build_array(
    jsonb_build_object('key','magic_class','text','Выберите класс для заговора','count',1,'source','inline','options',options),
    '{"key":"cantrip","text":"Выберите заговор с броском атаки","count":1,"source":"item","from_item_type_id":5,"item_filter":{"lvl":0,"damage.range_attack":true},"depends_on_choice":"magic_class","item_filter_from_choice":{"choice_key":"magic_class","path":"classes.id"},"grant_spells":true,"casting_ability_choice_key":"magic_class"}'::jsonb
  ) FROM class_options
  UNION ALL
  SELECT 'Ритуальный заклинатель', jsonb_build_array(
    jsonb_build_object('key','magic_class','text','Выберите класс для книги ритуалов','count',1,'source','inline','options',options),
    '{"key":"rituals","text":"Выберите два ритуала 1 уровня","count":2,"source":"item","from_item_type_id":5,"item_filter":{"lvl":1,"ritual":true},"depends_on_choice":"magic_class","item_filter_from_choice":{"choice_key":"magic_class","path":"classes.id"},"grant_spells":true,"casting_ability_choice_key":"magic_class","slotless":true,"cast_level":1}'::jsonb
  ) FROM class_options
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{choices}', rules.choices, true)
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

UPDATE dndshare.item
SET data = COALESCE(data, '{}'::jsonb) || '{"max_use":1,"rollback_long_rest":true,"resource_color":"#8b5cf6"}'::jsonb
WHERE type_id = 7 AND user_id IS NULL AND lower(name) = lower('Посвящённый в магию');

-- Choices whose effects are not spells.
UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"element","text":"Выберите тип урона","count":1,"source":"inline","unique_across_takes":true,"options":[{"value":8,"label":"Кислота"},{"value":13,"label":"Холод"},{"value":5,"label":"Огонь"},{"value":9,"label":"Электричество"},{"value":6,"label":"Звук"}]}]'::jsonb, true)
WHERE type_id = 7 AND user_id IS NULL AND lower(name) = lower('Адепт стихий');
UPDATE dndshare.item SET data = COALESCE(data, '{}'::jsonb) || '{"repeatable":true,"unique_choice_key":"element"}'::jsonb
WHERE type_id = 7 AND user_id IS NULL AND lower(name) = lower('Адепт стихий');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"maneuvers","text":"Выберите два боевых приёма","count":2,"source":"inline","options":[{"value":"commanders_strike","label":"Командирский удар"},{"value":"disarming_attack","label":"Обезоруживающая атака"},{"value":"distracting_strike","label":"Отвлекающий удар"},{"value":"evasive_footwork","label":"Уклонение"},{"value":"feinting_attack","label":"Ложная атака"},{"value":"goading_attack","label":"Провоцирующая атака"},{"value":"lunging_attack","label":"Выпад"},{"value":"maneuvering_attack","label":"Маневрирующая атака"},{"value":"menacing_attack","label":"Устрашающая атака"},{"value":"parry","label":"Парирование"},{"value":"precision_attack","label":"Точная атака"},{"value":"pushing_attack","label":"Толкающая атака"},{"value":"rally","label":"Воодушевление"},{"value":"riposte","label":"Ответный удар"},{"value":"sweeping_attack","label":"Размашистая атака"},{"value":"trip_attack","label":"Опрокидывающая атака"}]}]'::jsonb, true)
WHERE type_id = 7 AND user_id IS NULL AND lower(name) = lower('Мастер боевых искусств');

-- Source-owned permanent effects. Removing or disabling the feat immediately
-- removes the effect without leaving copied hidden flags on the sheet.
WITH rules(name_ru, effects) AS (
  VALUES
    ('Бдительность', '[{"kind":"check_bonus","value":5,"scopes":["initiative"],"label":"Бдительность"}]'::jsonb),
    ('Мобильный', '[{"kind":"speed_bonus","value":10,"label":"Мобильный"}]'::jsonb),
    ('Легко бронированный', '[{"kind":"armor_proficiency","target_ids":[9]}]'::jsonb),
    ('Умеренно бронированный', '[{"kind":"armor_proficiency","target_ids":[13,14]}]'::jsonb),
    ('Тяжело бронированный', '[{"kind":"armor_proficiency","target_ids":[16]}]'::jsonb),
    ('Мастер оружия', '[{"kind":"weapon_proficiency","choice_key":"weapons","target_from_choice":true}]'::jsonb),
    ('Лингвист', '[{"kind":"language_proficiency","choice_key":"languages","target_from_choice":true}]'::jsonb),
    ('Стойкий', '[{"kind":"save_proficiency","choice_key":"ability","target_from_choice":true}]'::jsonb),
    ('Знаток', '[{"kind":"skill_proficiency","choice_key":"proficiencies","choice_value_prefix":"skill","target_from_choice":true,"rank":1},{"kind":"tool_proficiency","choice_key":"proficiencies","choice_value_prefix":"tool","target_from_choice":true}]'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{derived_effects}', rules.effects, true)
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{hp_bonuses}', '[{"title":"Крепкий","per_level":2}]'::jsonb, true)
WHERE type_id = 7 AND user_id IS NULL AND lower(name) = lower('Крепкий');

-- Limited-use feats use the shared resource/rest contract.
WITH rules(name_ru, patch) AS (
  VALUES
    ('Удачливый', '{"max_use":3,"rollback_long_rest":true,"resource_color":"#f59e0b"}'::jsonb),
    ('Мастер боевых искусств', '{"max_use":1,"rollback_short_rest":true,"rollback_long_rest":true,"resource_color":"#ef4444"}'::jsonb)
)
UPDATE dndshare.item item SET data = COALESCE(item.data, '{}'::jsonb) || rules.patch
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

-- Every contextual PHB rule is exposed in the readonly status area. These
-- entries are declarative and can later feed turn/target-aware action modes;
-- until then the sheet never silently applies them to unrelated rolls.
WITH rules(name_ru, effects) AS (
  VALUES
    ('Адепт стихий', '[{"title":"Избранная стихия","description":"Сопротивление выбранному типу урона игнорируется; 1 на кубике урона выбранной стихии считается 2.","tone":"info"}]'::jsonb),
    ('Актёр', '[{"title":"Мастер перевоплощения","description":"Преимущество на Обман и Выступление при выдаче себя за другого; можно имитировать речь и звуки.","tone":"success"}]'::jsonb),
    ('Атлет', '[{"title":"Атлетическая подготовка","description":"Подъём из лежачего положения стоит 5 футов; лазание не замедляет, а разбег для прыжка — 5 футов.","tone":"info"}]'::jsonb),
    ('Бдительность', '[{"title":"Постоянная готовность","description":"Вас нельзя застать врасплох; невидимые атакующие не получают преимущество только из-за невидимости.","tone":"success"}]'::jsonb),
    ('Борец', '[{"title":"Опытный борец","description":"Преимущество на атаки по существу, которое вы держите в захвате; можно попытаться обездвижить обоих.","tone":"info"}]'::jsonb),
    ('Вдохновляющий лидер', '[{"title":"Воодушевляющая речь","description":"После 10 минут речи до шести существ получают временные хиты: ваш уровень + модификатор Харизмы.","tone":"success"}]'::jsonb),
    ('Выносливый', '[{"title":"Надёжное восстановление","description":"При восстановлении хитов костью хитов минимум каждой кости равен удвоенному модификатору Телосложения (минимум 2).","tone":"success"}]'::jsonb),
    ('Дуэлянт', '[{"title":"Защитный дуэлянт","description":"Реакцией добавьте бонус мастерства к КД против одной рукопашной атаки, когда держите фехтовальное оружие.","tone":"success"}]'::jsonb),
    ('Заклинатель в бою', '[{"title":"Боевая концентрация","description":"Преимущество на спасброски Телосложения для концентрации; соматика возможна с занятыми руками; провоцированную атаку можно заменить заклинанием.","tone":"success"}]'::jsonb),
    ('Знаток', '[{"title":"Дополнительное обучение","description":"Выбранные три навыка или инструмента считаются владениями.","tone":"info"}]'::jsonb),
    ('Исследователь подземелий', '[{"title":"Исследователь подземелий","description":"Преимущество на поиск потайных дверей и спасброски от ловушек; сопротивление урону ловушек и быстрый поиск без штрафа.","tone":"success"}]'::jsonb),
    ('Конный боец', '[{"title":"Конный боец","description":"Преимущество на атаки по пешим меньшего размера; атаки по скакуну можно перенаправлять, а успешные спасброски Ловкости защищают его от урона.","tone":"success"}]'::jsonb),
    ('Крепкий', '[{"title":"Повышенный максимум хитов","description":"Максимум хитов увеличен на 2 за каждый уровень персонажа.","tone":"success"}]'::jsonb),
    ('Легко бронированный', '[{"title":"Владение лёгкими доспехами","description":"Черта даёт владение лёгкими доспехами.","tone":"info"}]'::jsonb),
    ('Лекарь', '[{"title":"Полевой лекарь","description":"Набором лекаря можно стабилизировать с восстановлением 1 хита или один раз между отдыхами вылечить существо на 1к6 + 4 + максимум его костей хитов.","tone":"success"}]'::jsonb),
    ('Лингвист', '[{"title":"Шифры","description":"Можно создавать письменные шифры; выбранные три языка добавлены во владения.","tone":"info"}]'::jsonb),
    ('Мастер боевых искусств', '[{"title":"Боевые приёмы","description":"Вы знаете два выбранных приёма и располагаете одной костью превосходства к6; Сл приёма использует Силу или Ловкость.","tone":"info"}]'::jsonb),
    ('Мастер большого оружия', '[{"title":"Мощная атака","description":"После крита или убийства можно атаковать бонусным действием; перед атакой тяжёлым оружием можно получить −5 к атаке и +10 к урону.","tone":"warning"}]'::jsonb),
    ('Мастер древкового оружия', '[{"title":"Мастер древкового оружия","description":"Бонусная атака обратным концом древкового оружия наносит 1к4; вход в вашу досягаемость провоцирует атаку.","tone":"info"}]'::jsonb),
    ('Мастер оружия', '[{"title":"Оружейная подготовка","description":"Четыре выбранных вида оружия добавлены во владения.","tone":"info"}]'::jsonb),
    ('Мастер парного оружия', '[{"title":"Парное оружие","description":"+1 к КД с двумя оружиями; бой двумя оружиями разрешён без свойства «лёгкое», два оружия можно доставать одновременно.","tone":"success"}]'::jsonb),
    ('Мастер средних доспехов', '[{"title":"Мастер средних доспехов","description":"Средние доспехи не дают помеху Скрытности; максимум бонуса Ловкости к КД становится +3.","tone":"success"}]'::jsonb),
    ('Мастер тяжёлых доспехов', '[{"title":"Поглощение урона","description":"В тяжёлом доспехе немагический дробящий, колющий и рубящий урон уменьшается на 3.","tone":"success"}]'::jsonb),
    ('Мастер щита', '[{"title":"Мастер щита","description":"Щитом можно толкнуть бонусным действием; его бонус добавляется к отдельным спасброскам Ловкости, а реакция позволяет избежать урона при успехе.","tone":"success"}]'::jsonb),
    ('Меткий стрелок', '[{"title":"Меткий стрелок","description":"Дальняя дистанция не даёт помеху, игнорируются половинное и три четверти укрытия; можно получить −5 к атаке и +10 к урону.","tone":"info"}]'::jsonb),
    ('Мобильный', '[{"title":"Свободное перемещение","description":"Рывок отменяет штраф труднопроходимой местности; атакованная цель не совершает по вам провоцированную атаку в этот ход.","tone":"success"}]'::jsonb),
    ('Наблюдательный', '[{"title":"Наблюдательность","description":"Можно читать по губам; пассивные Внимательность и Анализ увеличиваются на 5.","tone":"success"}]'::jsonb),
    ('Налётчик', '[{"title":"Стремительный натиск","description":"После Рывка бонусным действием совершите атаку или толчок; при разбеге 10 футов атака получает +5 к урону либо толчок отбрасывает ещё на 10 футов.","tone":"info"}]'::jsonb),
    ('Острый ум', '[{"title":"Безошибочная память","description":"Всегда известны север, время до рассвета или заката; подробности последнего месяца помнятся точно.","tone":"info"}]'::jsonb),
    ('Посвящённый в магию', '[{"title":"Магическое посвящение","description":"Выбранные заговоры доступны постоянно; заклинание 1 уровня сотворяется один раз после продолжительного отдыха без ячейки.","tone":"info"}]'::jsonb),
    ('Ритуальный заклинатель', '[{"title":"Книга ритуалов","description":"Два выбранных заклинания доступны только как ритуалы; новые ритуалы выбранного класса можно переписывать в книгу.","tone":"info"}]'::jsonb),
    ('Свирепый атакующий', '[{"title":"Свирепая атака","description":"Один раз в ход можно перебросить все кости урона рукопашной атаки оружием и выбрать любой из двух результатов.","tone":"info"}]'::jsonb),
    ('Скрытный', '[{"title":"Скрытный стрелок","description":"Можно прятаться в слабой видимости; промах дальнобойной атакой не выдаёт позицию; тусклый свет не мешает Внимательности, основанной на зрении.","tone":"success"}]'::jsonb),
    ('Снайпер заклинаний', '[{"title":"Дальний заклинатель","description":"Дальность заклинаний с броском атаки удваивается; они игнорируют половинное и три четверти укрытия.","tone":"info"}]'::jsonb),
    ('Стойкий', '[{"title":"Новый спасбросок","description":"Вы получили владение спасбросками выбранной характеристики.","tone":"success"}]'::jsonb),
    ('Страж', '[{"title":"Страж","description":"Провоцированная атака останавливает цель; Отход не защищает от неё, а атака по союзнику позволяет ответить реакцией.","tone":"warning"}]'::jsonb),
    ('Трактирный буян', '[{"title":"Импровизированный боец","description":"Владение импровизированным оружием и безоружными ударами (к4); после попадания можно бонусным действием начать захват.","tone":"info"}]'::jsonb),
    ('Тяжело бронированный', '[{"title":"Владение тяжёлыми доспехами","description":"Черта даёт владение тяжёлыми доспехами.","tone":"info"}]'::jsonb),
    ('Убийца магов', '[{"title":"Убийца магов","description":"Заклинание рядом провоцирует атаку реакцией; преимущество на спасброски от соседних заклинателей, а ваш урон мешает их концентрации.","tone":"warning"}]'::jsonb),
    ('Удачливый', '[{"title":"Очки удачи","description":"Очко удачи позволяет добавить к20 к своей атаке, проверке или спасброску либо к атаке по вам и выбрать используемый результат.","tone":"success"}]'::jsonb),
    ('Умеренно бронированный', '[{"title":"Владение средними доспехами и щитами","description":"Черта даёт владение средними доспехами и щитами.","tone":"info"}]'::jsonb),
    ('Эксперт арбалета', '[{"title":"Эксперт арбалета","description":"Игнорируется перезарядка арбалета; соседний противник не даёт помеху дальнобойной атаке; после одноручной атаки можно атаковать ручным арбалетом бонусным действием.","tone":"info"}]'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{passive_effects}', rules.effects, true)
FROM rules WHERE item.type_id = 7 AND item.user_id IS NULL AND lower(item.name) = lower(rules.name_ru);

-- Lightweight dedicated icons for the two newly seeded feats.
DO $$
DECLARE target record; saved_svg_id int8;
BEGIN
  FOR target IN
    WITH icons(name_ru, svg) AS (VALUES
      ('Лекарь', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M12 21S4 16 4 9a4 4 0 0 1 7-3l1 1 1-1a4 4 0 0 1 7 3c0 7-8 12-8 12Z"/><path d="M12 9v7M8.5 12.5h7"/></svg>'),
      ('Скрытный', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 12s3-6 9-6 9 6 9 6-3 6-9 6-9-6-9-6Z"/><circle cx="12" cy="12" r="2.5"/><path d="m4 20 16-16"/></svg>')
    )
    SELECT item.id, icons.svg FROM icons JOIN dndshare.item item ON item.type_id = 7
      AND item.user_id IS NULL AND lower(item.name) = lower(icons.name_ru)
    WHERE item.icon_svg_id IS NULL AND item.icon_image_id IS NULL
  LOOP
    INSERT INTO dndshare.svg_storage(data) VALUES (target.svg) RETURNING id INTO saved_svg_id;
    UPDATE dndshare.item SET icon_svg_id = saved_svg_id WHERE id = target.id;
  END LOOP;
END $$;

UPDATE dndshare.item_type item_type
SET count_items = (SELECT COUNT(*) FROM dndshare.item item WHERE item.type_id = 7 AND item.user_id IS NULL)
WHERE item_type.id = 7;
