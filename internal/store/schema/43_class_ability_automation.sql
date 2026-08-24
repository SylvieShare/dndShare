-- Class features use the same source-driven contracts as race abilities and
-- feats. Derived effects describe sheet math; the frontend never checks a
-- feature name to decide how AC, speed, proficiencies or attacks work.
WITH addition AS (
  SELECT '{"name":"Производные эффекты","key":"derived_effects","type":"object_array","fields":[{"name":"Вид","key":"kind","type":"select","options":[{"value":"armor_formula","label":"Формула КД"},{"value":"armor_bonus","label":"Бонус КД"},{"value":"speed_bonus","label":"Бонус скорости"},{"value":"skill_proficiency","label":"Владение навыком"},{"value":"save_proficiency","label":"Владение спасброском"},{"value":"check_bonus","label":"Бонус проверки"},{"value":"skill_bonus","label":"Бонус навыка"},{"value":"save_bonus","label":"Бонус спасброска"},{"value":"weapon_attack_bonus","label":"Бонус атаки оружием"},{"value":"weapon_damage_bonus","label":"Бонус урона оружием"},{"value":"critical_threshold","label":"Порог критического попадания"},{"value":"roll_mode","label":"Режим броска"}]},{"name":"С уровня","key":"level","type":"int","default":1},{"name":"Значение","key":"value","type":"int"},{"name":"Параметр значения","key":"value_parameter","type":"text"},{"name":"База","key":"base","type":"int"},{"name":"Характеристики","key":"ability_ids","type":"suggest_array","suggest_id":16},{"name":"Ранг владения","key":"rank","type":"int"},{"name":"Ключ выбора","key":"choice_key","type":"text"},{"name":"Значения выбора","key":"choice_values","type":"text_array"},{"name":"Цель берётся из выбора","key":"target_from_choice","type":"bool"},{"name":"Группа прогрессии","key":"group","type":"text"},{"name":"Множитель мастерства","key":"proficiency_multiplier","type":"float"},{"name":"Только без владения","key":"only_without_proficiency","type":"bool"},{"name":"Характеристика-модификатор","key":"ability_modifier","type":"suggest","suggest_id":16},{"name":"Нужен доспех","key":"requires_armor","type":"bool"},{"name":"Без доспеха","key":"requires_no_armor","type":"bool"},{"name":"Разрешён щит","key":"allow_shield","type":"bool","default":true},{"name":"Не в тяжёлом доспехе","key":"forbid_heavy_armor","type":"bool"},{"name":"Вид оружия","key":"weapon_kind","type":"select","options":[{"value":"any","label":"Любое"},{"value":"melee","label":"Рукопашное"},{"value":"ranged","label":"Дальнобойное"}]},{"name":"Области броска","key":"scopes","type":"text_array"},{"name":"Режим","key":"mode","type":"select","options":[{"value":"advantage","label":"Преимущество"},{"value":"disadvantage","label":"Помеха"}]},{"name":"Пояснение","key":"label","type":"text"}]}'::jsonb AS field
)
UPDATE dndshare.item_type item_type
SET fields = CASE
  WHEN EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'derived_effects'
  ) THEN (
    SELECT jsonb_agg(CASE WHEN current.value ->> 'key' = 'derived_effects' THEN addition.field ELSE current.value END ORDER BY current.ordinality)
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY current(value, ordinality)
  )
  ELSE COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
END
FROM addition
WHERE item_type.id IN (3, 4, 7);

-- Values used by inline class choices are stable and therefore safe inputs
-- for derived-effect rules.
WITH style_choice AS (
  SELECT '[{"key":"choice","text":"Выберите один боевой стиль","count":1,"source":"inline","options":[{"value":"defense","label":"Оборона","desc":"+1 к КД, пока вы носите доспех."},{"value":"dueling","label":"Дуэлянт","desc":"+2 к урону одноручным оружием без второго оружия в руках."},{"value":"great_weapon","label":"Бой большим оружием","desc":"Перебрасывайте 1 и 2 на кубиках урона двуручного оружия."},{"value":"protection","label":"Защита","desc":"Реакцией с щитом даёте помеху атаке по союзнику."},{"value":"archery","label":"Стрельба","desc":"+2 к броскам дальнобойных атак оружием."},{"value":"two_weapon","label":"Бой двумя оружиями","desc":"Добавляете модификатор характеристики к урону второго оружия."}]}]'::jsonb AS choices
)
UPDATE dndshare.item item
SET data = jsonb_set(jsonb_set(COALESCE(item.data, '{}'::jsonb), '{choices}', style_choice.choices, true), '{derived_effects}',
  '[{"kind":"armor_bonus","value":1,"requires_armor":true,"choice_key":"choice","choice_values":["defense"],"label":"Боевой стиль: Оборона"},{"kind":"weapon_attack_bonus","value":2,"weapon_kind":"ranged","choice_key":"choice","choice_values":["archery"],"label":"Боевой стиль: Стрельба"}]'::jsonb, true)
FROM style_choice
WHERE item.type_id = 4 AND item.user_id IS NULL AND lower(item.name) IN (lower('Боевой стиль'), lower('Дополнительный боевой стиль'));

-- Preserve choices already made before inline options received stable values.
WITH rewritten AS (
  SELECT character.id,
         jsonb_agg(
           CASE
             WHEN lower(item.name) IN (lower('Боевой стиль'), lower('Дополнительный боевой стиль'))
              AND jsonb_typeof(entry.value #> '{choices,choice}') = 'array'
             THEN jsonb_set(entry.value, '{choices,choice}', COALESCE((
               SELECT jsonb_agg(to_jsonb(CASE lower(choice.value #>> '{}')
                 WHEN lower('Оборона') THEN 'defense'
                 WHEN lower('Дуэлянт') THEN 'dueling'
                 WHEN lower('Бой большим оружием') THEN 'great_weapon'
                 WHEN lower('Защита') THEN 'protection'
                 WHEN lower('Стрельба') THEN 'archery'
                 WHEN lower('Бой двумя оружиями') THEN 'two_weapon'
                 ELSE choice.value #>> '{}'
               END) ORDER BY choice.ordinal)
               FROM jsonb_array_elements(entry.value #> '{choices,choice}') WITH ORDINALITY AS choice(value, ordinal)
             ), '[]'::jsonb), true)
             WHEN lower(item.name) = lower('Благословения знания')
              AND jsonb_typeof(entry.value #> '{choices,choice}') = 'array'
             THEN jsonb_set(entry.value, '{choices,choice}', COALESCE((
               SELECT jsonb_agg(to_jsonb(CASE lower(choice.value #>> '{}')
                 WHEN lower('Магия') THEN '5'
                 WHEN lower('История') THEN '6'
                 WHEN lower('Природа') THEN '7'
                 WHEN lower('Религия') THEN '8'
                 ELSE choice.value #>> '{}'
               END) ORDER BY choice.ordinal)
               FROM jsonb_array_elements(entry.value #> '{choices,choice}') WITH ORDINALITY AS choice(value, ordinal)
             ), '[]'::jsonb), true)
             ELSE entry.value
           END
           ORDER BY entry.ordinal
         ) AS abilities
  FROM dndshare."char" character
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,abilities_class}') = 'array' THEN character.data #> '{values,abilities_class}'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS entry(value, ordinal)
  LEFT JOIN dndshare.item item ON item.id::text = entry.value ->> 'id'
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,abilities_class}', rewritten.abilities, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,abilities_class}' IS DISTINCT FROM rewritten.abilities;

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{hp_bonuses}', '[{"title":"Драконья стойкость","per_level":1}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Драконья стойкость');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"armor_formula","base":13,"ability_ids":[2],"allow_shield":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Драконья стойкость');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"armor_formula","base":10,"ability_ids":[2,3],"allow_shield":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Защита без доспеха');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"armor_formula","base":10,"ability_ids":[2,5],"allow_shield":false}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Защита без доспехов');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"speed_bonus","value":10,"forbid_heavy_armor":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Быстрое передвижение');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"speed_bonus","group":"unarmored_movement","value":10,"level":2,"requires_no_armor":true,"allow_shield":false},{"kind":"speed_bonus","group":"unarmored_movement","value":15,"level":6,"requires_no_armor":true,"allow_shield":false},{"kind":"speed_bonus","group":"unarmored_movement","value":20,"level":10,"requires_no_armor":true,"allow_shield":false},{"kind":"speed_bonus","group":"unarmored_movement","value":25,"level":14,"requires_no_armor":true,"allow_shield":false},{"kind":"speed_bonus","group":"unarmored_movement","value":30,"level":18,"requires_no_armor":true,"allow_shield":false}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Движение без доспехов');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{critical_damage}', '[{"weapon_kind":"melee","extra_weapon_dice":1,"level":9},{"weapon_kind":"melee","extra_weapon_dice":1,"level":13},{"weapon_kind":"melee","extra_weapon_dice":1,"level":17}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Жестокий критический удар');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"critical_threshold","value":19,"level":3,"weapon_kind":"any"}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Улучшенные критические попадания');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"critical_threshold","value":18,"level":15,"weapon_kind":"any"}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Превосходный критический удар');

-- Proficiencies remain source-owned. Removing the feature removes the effect;
-- no copied hidden flags are left behind in a skill or saving throw.
UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"skill_proficiency","rank":2,"choice_key":"choice","target_from_choice":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Компетентность');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"skill_proficiency","rank":1,"choice_key":"choice","target_from_choice":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) IN (lower('Дополнительные владения'), lower('Послушник природы'));

UPDATE dndshare.item
SET data = jsonb_set(jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"choice","text":"Выберите два навыка; бонус мастерства по ним удваивается","count":2,"source":"inline","options":[{"value":5,"label":"Магия"},{"value":6,"label":"История"},{"value":7,"label":"Природа"},{"value":8,"label":"Религия"}]}]'::jsonb, true), '{derived_effects}', '[{"kind":"skill_proficiency","rank":2,"choice_key":"choice","target_from_choice":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Благословения знания');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"check_bonus","proficiency_multiplier":0.5,"only_without_proficiency":true},{"kind":"skill_bonus","proficiency_multiplier":0.5,"only_without_proficiency":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Мастер на все руки');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"save_proficiency","ability_ids":[1,2,3,4,5,6]}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Алмазная душа');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"save_proficiency","ability_ids":[5]}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Скользкий ум');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{derived_effects}', '[{"kind":"save_bonus","ability_modifier":6}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Аура защиты');

-- Fixed damage defenses can be merged into the existing read-only defenses
-- block. Conditional and activated defenses stay descriptive.
WITH fixed(name_ru, defenses) AS (
  VALUES
    ('Защита мыслей', '[{"damage_type":11,"kind":"resistance"}]'::jsonb),
    ('Невосприимчивость к нежизни', '[{"damage_type":10,"kind":"resistance"}]'::jsonb),
    ('Химическое мастерство', '[{"damage_type":8,"kind":"resistance"},{"damage_type":4,"kind":"resistance"}]'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{defenses}', fixed.defenses, true)
FROM fixed WHERE item.type_id = 4 AND item.user_id IS NULL AND lower(item.name) = lower(fixed.name_ru);

-- Contextual rules are intentionally visible rather than silently applied to
-- unrelated rolls. They are ready to become inputs for future active modes.
WITH passives(name_ru, effects) AS (
  VALUES
    ('Ярость', '[{"title":"Эффекты ярости","description":"В активной ярости: преимущество на проверки и спасброски Силы, бонус к урону и сопротивление дробящему, колющему и рубящему урону; заклинания недоступны.","tone":"warning"}]'::jsonb),
    ('Безрассудная атака', '[{"title":"Безрассудная атака","description":"Можно получить преимущество на рукопашные атаки Силой, но атаки по вам до следующего хода также совершаются с преимуществом.","tone":"warning"}]'::jsonb),
    ('Опасное чутьё', '[{"title":"Опасное чутьё","description":"Преимущество на видимые спасброски Ловкости от эффектов.","tone":"success"}]'::jsonb),
    ('Бездумная ярость', '[{"title":"Защита в ярости","description":"Во время ярости вас нельзя очаровать или испугать.","tone":"success"}]'::jsonb),
    ('Звериное чутьё', '[{"title":"Преимущество инициативы","description":"Преимущество на броски инициативы; при внезапности можно начать ярость, чтобы действовать нормально.","tone":"success"}]'::jsonb),
    ('Стойкая ярость', '[{"title":"Стойкая ярость","description":"Ярость заканчивается досрочно только при потере сознания или по вашему решению.","tone":"info"}]'::jsonb),
    ('Контрочарование', '[{"title":"Контрочарование","description":"Союзники, слышащие исполнение, получают преимущество на спасброски от испуга и очарования.","tone":"success"}]'::jsonb),
    ('Сопротивление заклинаниям', '[{"title":"Сопротивление заклинаниям","description":"Преимущество на спасброски против заклинаний и сопротивление урону от заклинаний.","tone":"success"}]'::jsonb),
    ('Божественное здоровье', '[{"title":"Невосприимчивость к болезням","description":"Болезни не действуют на персонажа.","tone":"success"}]'::jsonb),
    ('Аура отваги', '[{"title":"Невосприимчивость к испугу","description":"Вы и союзники в ауре не можете быть испуганы.","tone":"success"}]'::jsonb),
    ('Чистота духа', '[{"title":"Постоянная защита от зла и добра","description":"На персонажа постоянно действует эффект защиты от зла и добра.","tone":"success"}]'::jsonb),
    ('Защита природы', '[{"title":"Защита природы","description":"Элементали и фейри не могут очаровать или испугать вас; вы невосприимчивы к яду и болезням.","tone":"success"}]'::jsonb),
    ('Чистота тела', '[{"title":"Чистота тела","description":"Невосприимчивость к болезням и яду.","tone":"success"}]'::jsonb),
    ('Чарующая защита', '[{"title":"Невосприимчивость к очарованию","description":"Очарование не действует; попытку очаровать можно отразить реакцией.","tone":"success"}]'::jsonb),
    ('Защита мыслей', '[{"title":"Защита мыслей","description":"Мысли нельзя прочесть без согласия; полученный психический урон отражается источнику.","tone":"success"}]'::jsonb),
    ('Невосприимчивость к нежизни', '[{"title":"Закалённый максимум хитов","description":"Максимум хитов нельзя уменьшить.","tone":"success"}]'::jsonb),
    ('Химическое мастерство', '[{"title":"Химическая защита","description":"Невосприимчивость к состоянию «отравлен».","tone":"success"}]'::jsonb),
    ('Уклонение', '[{"title":"Уклонение","description":"При спасброске Ловкости на половину урона: при успехе урона нет, при провале — половина.","tone":"success"}]'::jsonb),
    ('Неуловимый', '[{"title":"Неуловимый","description":"Атаки не получают преимущество против вас, пока вы дееспособны.","tone":"success"}]'::jsonb),
    ('Удары, наполненные ци', '[{"title":"Магические безоружные удары","description":"Безоружные удары считаются магическими для преодоления сопротивлений и иммунитетов.","tone":"info"}]'::jsonb),
    ('Первобытный удар', '[{"title":"Магические атаки зверя","description":"Атаки в облике зверя считаются магическими для преодоления сопротивлений и иммунитетов.","tone":"info"}]'::jsonb),
    ('Аватар битвы', '[{"title":"Защита от немагического оружия","description":"Сопротивление дробящему, колющему и рубящему урону от немагического оружия.","tone":"success"}]'::jsonb)
)
UPDATE dndshare.item item SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{passive_effects}', passives.effects, true)
FROM passives WHERE item.type_id = 4 AND item.user_id IS NULL AND lower(item.name) = lower(passives.name_ru);

-- Fixed-count spell selections can use the existing item-choice grant
-- contract immediately. Progressive selections remain represented by their
-- own feature rows until the character gains the corresponding level.
UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"druid_cantrip","text":"Выберите один заговор друида","count":1,"source":"item","from_item_type_id":5,"item_filter":"{\"lvl\":0,\"classes.id\":4019}","grant_spells":true,"casting_ability":5}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Дополнительный заговор');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"magical_secrets","text":"Выберите два заклинания","count":2,"source":"item","from_item_type_id":5,"grant_spells":true,"casting_ability":6}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Дополнительные тайны магии');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"magical_secrets","text":"Выберите два заклинания","count":2,"source":"item","from_item_type_id":5,"grant_spells":true,"casting_ability":6}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Тайны магии');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"spell_mastery_1","text":"Выберите заклинание 1 круга","count":1,"source":"item","from_item_type_id":5,"item_filter":"{\"lvl\":1,\"classes.id\":4014}","grant_spells":true,"casting_ability":4,"slotless":true},{"key":"spell_mastery_2","text":"Выберите заклинание 2 круга","count":1,"source":"item","from_item_type_id":5,"item_filter":"{\"lvl\":2,\"classes.id\":4014}","grant_spells":true,"casting_ability":4,"slotless":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Знаток заклинаний');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"signature_spells","text":"Выберите два заклинания 3 круга","count":2,"source":"item","from_item_type_id":5,"item_filter":"{\"lvl\":3,\"classes.id\":4014}","grant_spells":true,"casting_ability":4,"slotless":true}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Подписные заклинания');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"enemy","text":"Выберите избранного врага","count":1,"source":"inline","options":[{"value":"aberrations","label":"Аберрации"},{"value":"beasts","label":"Звери"},{"value":"celestials","label":"Небожители"},{"value":"constructs","label":"Конструкты"},{"value":"dragons","label":"Драконы"},{"value":"elementals","label":"Элементали"},{"value":"fey","label":"Фейри"},{"value":"fiends","label":"Исчадия"},{"value":"giants","label":"Великаны"},{"value":"monstrosities","label":"Монстры"},{"value":"oozes","label":"Слизи"},{"value":"plants","label":"Растения"},{"value":"undead","label":"Нежить"},{"value":"humanoids","label":"Два вида гуманоидов"}]}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Избранный враг');

UPDATE dndshare.item SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"terrain","text":"Выберите излюбленную местность","count":1,"source":"inline","options":[{"value":"arctic","label":"Арктика"},{"value":"coast","label":"Побережье"},{"value":"desert","label":"Пустыня"},{"value":"forest","label":"Лес"},{"value":"grassland","label":"Луг"},{"value":"mountain","label":"Горы"},{"value":"swamp","label":"Болото"},{"value":"underdark","label":"Подземье"}]}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Исследователь природы');

UPDATE dndshare.item_type item_type
SET count_items = (SELECT COUNT(*) FROM dndshare.item item WHERE item.type_id = item_type.id AND item.user_id IS NULL)
WHERE item_type.id = 4;
