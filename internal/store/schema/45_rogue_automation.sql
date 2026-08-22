-- Rogue audit: expertise, subclass spellcasting and visible damage scaling use
-- generic handbook contracts. Runtime code never checks Rogue feature names or
-- the ids of Arcane Trickster / Eldritch Knight.

-- Extend the shared choice editor with union dictionaries and character-bound
-- eligibility rules used by expertise-like features.
WITH additions(fields) AS (
  VALUES ('[{"name":"Источники словарей","key":"suggest_sources","type":"object_array","fields":[{"name":"Словарь","key":"suggest_id","type":"int"},{"name":"Префикс","key":"prefix","type":"text"},{"name":"Подпись","key":"label","type":"text"}]},{"name":"Требуется владение","key":"requires_proficiency","type":"bool"},{"name":"Исключить достигнутый ранг","key":"exclude_rank","type":"int"}]'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN field ->> 'key' = 'choices' THEN jsonb_set(
      field,
      '{fields}',
      COALESCE(field -> 'fields', '[]'::jsonb) || additions.fields,
      true
    ) ELSE field END
    ORDER BY ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
  CROSS JOIN additions
)
WHERE item_type.id IN (3, 4, 7)
  AND EXISTS (SELECT 1 FROM jsonb_array_elements(item_type.fields) field WHERE field ->> 'key' = 'choices')
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) subfield
    WHERE field ->> 'key' = 'choices' AND subfield ->> 'key' = 'requires_proficiency'
  );

-- Editors expose caster contribution only on classes/subclasses and visible
-- scaling only on abilities.
WITH addition(field) AS (
  VALUES ('{"name":"Прогрессия ячеек","key":"caster_progression","type":"select","options":[{"value":"full","label":"Полный заклинатель"},{"value":"half","label":"Половина уровня"},{"value":"halfup","label":"Половина с округлением вверх"},{"value":"third","label":"Треть уровня"},{"value":"pact","label":"Магия договора"}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id = 9
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) field WHERE field ->> 'key' = 'caster_progression');

WITH addition(field) AS (
  VALUES ('{"name":"Отображаемая прогрессия","key":"display_scaling","type":"object_array","fields":[{"name":"С уровня","key":"level","type":"int","default":1},{"name":"Подпись","key":"label","type":"text"}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id = 4
  AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) field WHERE field ->> 'key' = 'display_scaling');

WITH additions(fields) AS (
  VALUES ('[{"name":"Тип прогрессии","key":"progression","type":"select","options":[{"value":"full","label":"Полный заклинатель"},{"value":"half","label":"Половина уровня"},{"value":"halfup","label":"Половина с округлением вверх"},{"value":"third","label":"Треть уровня"},{"value":"pact","label":"Магия договора"}]},{"name":"Список заклинаний класса","key":"list_class","type":"item","item_type":9},{"name":"Прогрессия известных заклинаний","key":"known_progression","type":"object_array","fields":[{"name":"Уровень класса","key":"level","type":"int"},{"name":"Заговоров","key":"cantrips","type":"int"},{"name":"Заклинаний","key":"spells","type":"int"}]},{"name":"Основные школы","key":"allowed_schools","type":"suggest_array","suggest_id":7},{"name":"Прогрессия исключений школ","key":"unrestricted_progression","type":"object_array","fields":[{"name":"Уровень класса","key":"level","type":"int"},{"name":"Количество","key":"count","type":"int"}]}]'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN field ->> 'key' = 'spellcasting' THEN jsonb_set(
      field,
      '{fields}',
      COALESCE(field -> 'fields', '[]'::jsonb) || additions.fields,
      true
    ) ELSE field END
    ORDER BY ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
  CROSS JOIN additions
)
WHERE item_type.id = 9
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) subfield
    WHERE field ->> 'key' = 'spellcasting' AND subfield ->> 'key' = 'known_progression'
  );

-- All caster kinds are materialized once into handbook data. Names are used
-- only by this startup migration to locate legacy catalogue rows.
WITH caster(name_en, progression) AS (
  VALUES
    ('Bard', 'full'), ('Cleric', 'full'), ('Druid', 'full'),
    ('Sorcerer', 'full'), ('Wizard', 'full'),
    ('Paladin', 'half'), ('Ranger', 'half'), ('Artificer', 'halfup'),
    ('Warlock', 'pact'), ('Eldritch Knight', 'third'), ('Arcane Trickster', 'third')
)
UPDATE dndshare.item item
SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{caster_progression}', to_jsonb(caster.progression), true)
FROM caster
WHERE item.type_id = 9 AND item.user_id IS NULL AND lower(item.name_en) = lower(caster.name_en);

-- Rogue Expertise may target a proficient skill or thieves' tools. Both
-- derived rules are source-owned and the tool roll consumes the resulting rank.
UPDATE dndshare.item
SET data = jsonb_set(
  jsonb_set(COALESCE(data, '{}'::jsonb), '{choices}', '[{"key":"choice","text":"Выберите два владения: навыки или воровские инструменты; бонус мастерства удваивается","count":2,"source":"suggest_union","suggest_sources":[{"suggest_id":15,"prefix":"skill","label":"Навык"},{"suggest_id":5,"prefix":"tool","label":"Инструмент"}],"requires_proficiency":true,"exclude_rank":2}]'::jsonb, true),
  '{derived_effects}',
  '[{"kind":"skill_proficiency","rank":2,"choice_key":"choice","choice_value_prefix":"skill","target_from_choice":true},{"kind":"tool_proficiency","rank":2,"choice_key":"choice","choice_value_prefix":"tool","target_from_choice":true}]'::jsonb,
  true
)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Компетентность');

-- Existing expertise choices were plain skill ids. Namespace them so old
-- characters keep exactly the same selections under the union contract.
WITH rewritten AS (
  SELECT character.id,
         jsonb_agg(
           CASE WHEN lower(item.name) = lower('Компетентность')
             AND jsonb_typeof(entry.value #> '{choices,choice}') = 'array'
           THEN jsonb_set(entry.value, '{choices,choice}', COALESCE((
             SELECT jsonb_agg(to_jsonb(CASE
               WHEN choice.value #>> '{}' LIKE '%:%' THEN choice.value #>> '{}'
               ELSE 'skill:' || (choice.value #>> '{}')
             END) ORDER BY choice.ordinal)
             FROM jsonb_array_elements(entry.value #> '{choices,choice}') WITH ORDINALITY AS choice(value, ordinal)
           ), '[]'::jsonb), true)
           ELSE entry.value END
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

-- Sneak Attack has a generic, visible level-based label. Its combat execution
-- can later consume the same progression without changing the ability list.
UPDATE dndshare.item
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{display_scaling}', '[{"level":1,"label":"1к6"},{"level":3,"label":"2к6"},{"level":5,"label":"3к6"},{"level":7,"label":"4к6"},{"level":9,"label":"5к6"},{"level":11,"label":"6к6"},{"level":13,"label":"7к6"},{"level":15,"label":"8к6"},{"level":17,"label":"9к6"},{"level":19,"label":"10к6"}]'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Скрытая атака');

-- Arcane Trickster rules: Wizard list, Intelligence, known-spell table and the
-- PHB Enchantment/Illusion restriction with exceptions at 3/8/14/20.
WITH wizard AS (
  SELECT id FROM dndshare.item
  WHERE type_id = 9 AND user_id IS NULL AND lower(name_en) = lower('Wizard')
  ORDER BY id LIMIT 1
), schools AS (
  SELECT COALESCE(jsonb_agg(id ORDER BY id), '[]'::jsonb) AS ids
  FROM dndshare.suggest
  WHERE type_id = 7 AND user_id IS NULL
    AND (lower(value) LIKE '%очар%' OR lower(value) LIKE '%иллюз%')
), rules AS (
  SELECT jsonb_build_object(
    'ability', 4,
    'progression', 'third',
    'list_class', jsonb_build_object('id', wizard.id),
    'cantrips_known', 3,
    'spells_known', 3,
    'known_progression', '[{"level":3,"cantrips":3,"spells":3},{"level":4,"cantrips":3,"spells":4},{"level":7,"cantrips":3,"spells":5},{"level":8,"cantrips":3,"spells":6},{"level":10,"cantrips":4,"spells":7},{"level":11,"cantrips":4,"spells":8},{"level":13,"cantrips":4,"spells":9},{"level":14,"cantrips":4,"spells":10},{"level":16,"cantrips":4,"spells":11},{"level":19,"cantrips":4,"spells":12},{"level":20,"cantrips":4,"spells":13}]'::jsonb,
    'allowed_schools', schools.ids,
    'unrestricted_progression', '[{"level":3,"count":1},{"level":8,"count":2},{"level":14,"count":3},{"level":20,"count":4}]'::jsonb,
    'prepares', false,
    'note', 'Заклинания из списка волшебника. Большинство изученных заклинаний должны относиться к школам Очарования или Иллюзии.'
  ) AS spellcasting
  FROM wizard CROSS JOIN schools
)
UPDATE dndshare.item item
SET data = jsonb_set(
  jsonb_set(COALESCE(item.data, '{}'::jsonb), '{caster_progression}', '"third"'::jsonb, true),
  '{spellcasting}', rules.spellcasting, true
)
FROM rules
WHERE item.type_id = 9 AND item.user_id IS NULL AND lower(item.name_en) = lower('Arcane Trickster');

UPDATE dndshare.item
SET data = jsonb_set(data, '{granted_spells,0,counts_as_known}', 'true'::jsonb, true)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Магическая рука-фокусник')
  AND jsonb_typeof(data -> 'granted_spells') = 'array'
  AND jsonb_array_length(data -> 'granted_spells') > 0;

-- Expose the known-spell flag on granted spell rows instead of hiding it in a
-- one-off catalogue migration.
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN field ->> 'key' = 'granted_spells' THEN jsonb_set(
      field,
      '{fields}',
      COALESCE(field -> 'fields', '[]'::jsonb) || '[{"name":"Считается известным","key":"counts_as_known","type":"bool"}]'::jsonb,
      true
    ) ELSE field END
    ORDER BY ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
)
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) subfield
    WHERE field ->> 'key' = 'granted_spells' AND subfield ->> 'key' = 'counts_as_known'
  );
