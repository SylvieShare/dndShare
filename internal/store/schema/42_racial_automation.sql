-- Racial automation is expressed through shared, editable ability contracts.
-- The sheet consumes these fields without checking Russian or English names.
WITH additions(field, ordinal) AS (
    VALUES
      ('{"name":"Бонусы к максимуму хитов","key":"hp_bonuses","type":"object_array","fields":[{"name":"Название","key":"title","type":"text"},{"name":"Постоянный бонус","key":"base","type":"int"},{"name":"За каждый уровень","key":"per_level","type":"int"},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb, 1),
      ('{"name":"Пассивные свойства","key":"passive_effects","type":"object_array","fields":[{"name":"Название","key":"title","type":"text"},{"name":"Пояснение","key":"description","type":"text"},{"name":"Вид","key":"tone","type":"select","default":"info","options":[{"value":"info","label":"Информация"},{"value":"success","label":"Защита"},{"value":"warning","label":"Условие"},{"value":"danger","label":"Ограничение"}]},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb, 2),
      ('{"name":"Триггеры броска","key":"roll_triggers","type":"object_array","fields":[{"name":"Событие","key":"event","type":"select","options":[{"value":"natural_one","label":"Натуральная 1"}]},{"name":"Действие","key":"action","type":"select","options":[{"value":"reroll","label":"Предложить переброс"}]},{"name":"Текст действия","key":"label","type":"text"},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb, 3),
      ('{"name":"Модификаторы критического урона","key":"critical_damage","type":"object_array","fields":[{"name":"Вид оружия","key":"weapon_kind","type":"select","options":[{"value":"melee","label":"Рукопашное"},{"value":"any","label":"Любое"}]},{"name":"Дополнительных костей оружия","key":"extra_weapon_dice","type":"int","default":1},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb, 4)
      ,('{"name":"Защиты по выбору","key":"choice_defenses","type":"object_array","fields":[{"name":"ID способности с выбором","key":"source_item_id","type":"int"},{"name":"Ключ выбора","key":"choice_key","type":"text"},{"name":"Соответствия","key":"options","type":"object_array","fields":[{"name":"Значение выбора","key":"value","type":"text"},{"name":"Тип урона","key":"damage_type","type":"suggest","suggest_id":12},{"name":"Вид защиты","key":"kind","type":"select","default":"resistance","options":[{"value":"resistance","label":"Сопротивление"},{"value":"immunity","label":"Невосприимчивость"},{"value":"vulnerability","label":"Уязвимость"}]}]}]}'::jsonb, 5)
), missing AS (
    SELECT item_type.id, jsonb_agg(additions.field ORDER BY additions.ordinal) AS fields
    FROM dndshare.item_type item_type
    CROSS JOIN additions
    WHERE item_type.id IN (3, 4, 7)
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
        WHERE current ->> 'key' = additions.field ->> 'key'
      )
    GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || missing.fields
FROM missing
WHERE item_type.id = missing.id;

-- Item choices can directly grant the selected spells. This keeps racial
-- cantrips configurable on the ability card and preserves their casting stat.
WITH rewritten AS (
  SELECT item_type.id,
         jsonb_agg(
           CASE WHEN field.value ->> 'key' = 'choices' THEN
             jsonb_set(
               field.value,
               '{fields}',
               COALESCE(field.value -> 'fields', '[]'::jsonb)
                 || '[{"name":"Добавить выбранные заклинания","key":"grant_spells","type":"bool"},{"name":"Характеристика заклинаний","key":"casting_ability","type":"suggest","suggest_id":16},{"name":"Без расхода ячейки","key":"slotless","type":"bool"},{"name":"С уровня","key":"level","type":"int","default":1}]'::jsonb,
               true
             )
           ELSE field.value END
           ORDER BY field.ordinality
         ) AS fields
  FROM dndshare.item_type item_type
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) WITH ORDINALITY AS field(value, ordinality)
  WHERE item_type.id IN (3, 4)
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE((
        SELECT choice.value -> 'fields'
        FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) choice(value)
        WHERE choice.value ->> 'key' = 'choices'
        LIMIT 1
      ), '[]'::jsonb)) nested
      WHERE nested ->> 'key' = 'grant_spells'
    )
  GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type SET fields = rewritten.fields
FROM rewritten WHERE item_type.id = rewritten.id;

-- Maximum HP used to be a scalar. Preserve it as the auditable base and keep
-- future manual/source bonuses separate.
UPDATE dndshare."char" character
SET data = jsonb_set(
    character.data,
    '{values,hp,max}',
    jsonb_build_object(
      'base', GREATEST(0, COALESCE((character.data #>> '{values,hp,max}')::int, 0)),
      'bonuses', '[]'::jsonb
    ),
    true
)
WHERE jsonb_typeof(character.data #> '{values,hp,max}') = 'number';

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{hp_bonuses}', '[{"title":"Дварфская стойкость","per_level":1}]'::jsonb, true)
WHERE type_id = 3 AND user_id IS NULL AND lower(name) = lower('Дварфская стойкость');

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{roll_triggers}', '[{"event":"natural_one","action":"reroll","label":"Перебросить — Везучий"}]'::jsonb, true)
WHERE type_id = 3 AND user_id IS NULL AND lower(name) = lower('Везучий');

UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{critical_damage}', '[{"weapon_kind":"melee","extra_weapon_dice":1}]'::jsonb, true)
WHERE type_id = 3 AND user_id IS NULL AND lower(name) = lower('Свирепые атаки');

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{choices}',
  '[{"key":"wizard_cantrip","text":"Выберите один заговор волшебника","count":1,"source":"item","from_item_type_id":5,"item_filter":"{\"lvl\":0,\"classes.id\":4014}","grant_spells":true,"casting_ability":4}]'::jsonb,
  true
)
WHERE type_id = 3 AND user_id IS NULL AND lower(name) = lower('Заговор волшебника');

WITH dragon_features AS (
  SELECT
    MAX(id) FILTER (WHERE lower(name) = lower('Оружие дыхания')) AS breath_id,
    MAX(id) FILTER (WHERE lower(name) = lower('Сопротивление урону')) AS resistance_id
  FROM dndshare.item
  WHERE type_id = 3 AND user_id IS NULL
)
UPDATE dndshare.item item
SET data = jsonb_set(
  COALESCE(item.data, '{}'::jsonb),
  '{choices}',
  '[{"key":"ancestry","text":"Выберите драконье наследие","count":1,"source":"inline","options":[{"value":"black","label":"Чёрный — кислота"},{"value":"blue","label":"Синий — молния"},{"value":"brass","label":"Латунный — огонь"},{"value":"bronze","label":"Бронзовый — молния"},{"value":"copper","label":"Медный — кислота"},{"value":"gold","label":"Золотой — огонь"},{"value":"green","label":"Зелёный — яд"},{"value":"red","label":"Красный — огонь"},{"value":"silver","label":"Серебряный — холод"},{"value":"white","label":"Белый — холод"}]}]'::jsonb,
  true
)
FROM dragon_features
WHERE item.id = dragon_features.breath_id;

WITH dragon_features AS (
  SELECT
    MAX(id) FILTER (WHERE lower(name) = lower('Оружие дыхания')) AS breath_id,
    MAX(id) FILTER (WHERE lower(name) = lower('Сопротивление урону')) AS resistance_id
  FROM dndshare.item
  WHERE type_id = 3 AND user_id IS NULL
)
UPDATE dndshare.item item
SET data = jsonb_set(
  COALESCE(item.data, '{}'::jsonb),
  '{choice_defenses}',
  jsonb_build_array(jsonb_build_object(
    'source_item_id', dragon_features.breath_id,
    'choice_key', 'ancestry',
    'options', '[{"value":"black","damage_type":8,"kind":"resistance"},{"value":"blue","damage_type":9,"kind":"resistance"},{"value":"brass","damage_type":5,"kind":"resistance"},{"value":"bronze","damage_type":9,"kind":"resistance"},{"value":"copper","damage_type":8,"kind":"resistance"},{"value":"gold","damage_type":5,"kind":"resistance"},{"value":"green","damage_type":4,"kind":"resistance"},{"value":"red","damage_type":5,"kind":"resistance"},{"value":"silver","damage_type":13,"kind":"resistance"},{"value":"white","damage_type":13,"kind":"resistance"}]'::jsonb
  )),
  true
)
FROM dragon_features
WHERE item.id = dragon_features.resistance_id AND dragon_features.breath_id IS NOT NULL;

-- Read-only sheet properties: these are deliberately descriptive. Contextual
-- effects are visible without silently forcing every unrelated roll.
WITH passives(name_ru, effects) AS (
  VALUES
    ('Храбрый', '[{"title":"Преимущество против испуга","description":"Преимущество на спасброски от состояния «испуган». Зависит от эффекта, который вызвал спасбросок.","tone":"success"}]'::jsonb),
    ('Дварфская устойчивость', '[{"title":"Преимущество против яда","description":"Преимущество на спасброски против яда.","tone":"success"}]'::jsonb),
    ('Выносливость коренастых', '[{"title":"Преимущество против яда","description":"Преимущество на спасброски против яда.","tone":"success"}]'::jsonb),
    ('Гномья хитрость', '[{"title":"Гномья хитрость","description":"Преимущество на спасброски Интеллекта, Мудрости и Харизмы против магии.","tone":"success"}]'::jsonb),
    ('Наследие фей', '[{"title":"Защита от очарования","description":"Преимущество на спасброски от очарования.","tone":"success"},{"title":"Магический сон не действует","description":"Магия не может усыпить персонажа.","tone":"success"}]'::jsonb),
    ('Чувствительность к солнцу', '[{"title":"Чувствительность к солнцу","description":"На прямом солнечном свету возможна помеха на атаки и проверки Восприятия, основанные на зрении.","tone":"danger"}]'::jsonb),
    ('Тёмное зрение', '[{"title":"Тёмное зрение","description":"Дальность и подробности указаны в описании способности.","tone":"info"}]'::jsonb),
    ('Транс', '[{"title":"Транс","description":"Для отдыха достаточно 4 часов медитации вместо обычного сна.","tone":"info"}]'::jsonb),
    ('Знание камня', '[{"title":"Знание камня","description":"Удвоенный бонус мастерства к подходящим проверкам Истории, связанным с каменной кладкой.","tone":"info"}]'::jsonb),
    ('Знание ремесленника', '[{"title":"Знание ремесленника","description":"Удвоенный бонус мастерства к подходящим проверкам Истории о магических, алхимических и технологических предметах.","tone":"info"}]'::jsonb),
    ('Маскировка дикой местности', '[{"title":"Маскировка дикой местности","description":"Можно попытаться спрятаться при слабой природной маскировке.","tone":"info"}]'::jsonb),
    ('Природная скрытность', '[{"title":"Природная скрытность","description":"Можно попытаться спрятаться за существом большего размера.","tone":"info"}]'::jsonb),
    ('Проворство полуросликов', '[{"title":"Проворство полуросликов","description":"Можно проходить сквозь пространство существ большего размера.","tone":"info"}]'::jsonb),
    ('Общение с маленькими зверями', '[{"title":"Общение с маленькими зверями","description":"Можно сообщать простые идеи маленьким зверям при помощи звуков и жестов.","tone":"info"}]'::jsonb)
)
UPDATE dndshare.item item
SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{passive_effects}', passives.effects, true)
FROM passives
WHERE item.type_id = 3 AND item.user_id IS NULL AND lower(item.name) = lower(passives.name_ru);

-- Creation-only pseudo-features have been migrated to race choices/fixed
-- grants since schema 39. Remove their catalogue cards after unlinking them.
WITH retired AS (
  SELECT id FROM dndshare.item
  WHERE type_id = 3 AND user_id IS NULL
    AND lower(name) IN (lower('Дополнительный язык'), lower('Универсальность навыков'), lower('Обострённые чувства'))
)
DELETE FROM dndshare.item_content_source link USING retired WHERE link.item_id = retired.id;

WITH retired AS (
  SELECT id FROM dndshare.item
  WHERE type_id = 3 AND user_id IS NULL
    AND lower(name) IN (lower('Дополнительный язык'), lower('Универсальность навыков'), lower('Обострённые чувства'))
)
DELETE FROM dndshare.item_version_compatibility link USING retired WHERE link.item_id = retired.id;

DELETE FROM dndshare.item
WHERE type_id = 3 AND user_id IS NULL
  AND lower(name) IN (lower('Дополнительный язык'), lower('Универсальность навыков'), lower('Обострённые чувства'));

UPDATE dndshare.item_type item_type
SET count_items = (SELECT COUNT(*) FROM dndshare.item item WHERE item.type_id = item_type.id AND item.user_id IS NULL)
WHERE item_type.id = 3;
