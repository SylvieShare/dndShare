-- Active effects are catalogue items. Source abilities/spells only link to
-- them, while a character stores small runtime instances in values.states.
INSERT INTO dndshare.item_type (id, name, fields, source_id, color, important, description)
VALUES (
  15,
  'Эффекты',
  '[{"name":"Описание","key":"desc","type":"description"},{"name":"Полярность","key":"polarity","type":"select","default":"neutral","filter":true,"options":[{"value":"positive","label":"Положительный"},{"value":"negative","label":"Отрицательный"},{"value":"neutral","label":"Нейтральный"}]},{"name":"Цвет","key":"color","type":"color","default":"#7c5cff"},{"name":"Наложение","key":"stacking","type":"select","default":"single","options":[{"value":"single","label":"Один экземпляр"},{"value":"multiple","label":"Несколько экземпляров"}]},{"name":"Длительность","key":"duration","type":"object","fields":[{"name":"Вид","key":"kind","type":"select","default":"manual","options":[{"value":"manual","label":"До ручного снятия"},{"value":"rounds","label":"Раунды"},{"value":"minutes","label":"Минуты"},{"value":"hours","label":"Часы"},{"value":"until_rest","label":"До отдыха"},{"value":"permanent","label":"Постоянно"}]},{"name":"Значение","key":"value","type":"int"}]},{"name":"Концентрация","key":"concentration","type":"bool"},{"name":"Производные эффекты","key":"derived_effects","type":"object_array","fields":[{"name":"Вид","key":"kind","type":"select","options":[{"value":"armor_bonus","label":"Бонус КД"},{"value":"speed_bonus","label":"Бонус скорости"},{"value":"check_bonus","label":"Бонус проверки"},{"value":"skill_bonus","label":"Бонус навыка"},{"value":"save_bonus","label":"Бонус спасброска"},{"value":"weapon_attack_bonus","label":"Бонус атаки оружием"},{"value":"weapon_damage_bonus","label":"Бонус урона оружием"},{"value":"roll_mode","label":"Режим броска"}]},{"name":"Значение","key":"value","type":"int"},{"name":"Параметр значения","key":"value_parameter","type":"text"},{"name":"Характеристики","key":"ability_ids","type":"suggest_array","suggest_id":16},{"name":"Вид оружия","key":"weapon_kind","type":"select","options":[{"value":"any","label":"Любое"},{"value":"melee","label":"Рукопашное"},{"value":"ranged","label":"Дальнобойное"}]},{"name":"Области броска","key":"scopes","type":"text_array"},{"name":"Режим","key":"mode","type":"select","options":[{"value":"advantage","label":"Преимущество"},{"value":"disadvantage","label":"Помеха"}]},{"name":"Пояснение","key":"label","type":"text"}]},{"name":"Защиты","key":"defenses","type":"object_array","fields":[{"name":"Тип урона","key":"damage_type","type":"suggest","suggest_id":12},{"name":"Вид защиты","key":"kind","type":"select","default":"resistance","options":[{"value":"resistance","label":"Сопротивление"},{"value":"immunity","label":"Невосприимчивость"},{"value":"vulnerability","label":"Уязвимость"}]}]}]'::jsonb,
  (SELECT id FROM dndshare."source" WHERE lower(name) = lower('DND5e') LIMIT 1),
  '#7c5cff',
  true,
  'Положительные, отрицательные и нейтральные состояния с механическими правилами.'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  fields = EXCLUDED.fields,
  source_id = COALESCE(dndshare.item_type.source_id, EXCLUDED.source_id),
  color = EXCLUDED.color,
  important = EXCLUDED.important,
  description = EXCLUDED.description;

SELECT setval(
  pg_get_serial_sequence('dndshare.item_type', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM dndshare.item_type), 15), 15),
  true
);

-- Any ability, feat or spell may expose several independently activatable
-- effects. Bindings copy a runtime value (for example a class scaling row)
-- into the effect instance without duplicating the effect catalogue item.
WITH addition(field) AS (
  VALUES ('{"name":"Связанные эффекты","key":"status_effects","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Эффект","key":"effect","type":"item","item_type":15},{"name":"Параметры","key":"parameter_bindings","type":"object_array","fields":[{"name":"Параметр","key":"key","type":"text"},{"name":"Источник","key":"source","type":"select","options":[{"value":"scaling_value","label":"Текущее значение прогрессии"},{"value":"fixed","label":"Постоянное значение"}]},{"name":"Значение","key":"value","type":"int"}]},{"name":"Концентрация","key":"concentration","type":"bool"},{"name":"Длительность","key":"duration","type":"object","fields":[{"name":"Вид","key":"kind","type":"select","default":"manual","options":[{"value":"manual","label":"До ручного снятия"},{"value":"rounds","label":"Раунды"},{"value":"minutes","label":"Минуты"},{"value":"hours","label":"Часы"},{"value":"until_rest","label":"До отдыха"},{"value":"permanent","label":"Постоянно"}]},{"name":"Значение","key":"value","type":"int"}]}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id IN (3, 4, 5, 7)
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'status_effects'
  );

-- Preserve the former condition catalogue as real effect items. It remains
-- editable and gains polarity/mechanics instead of being a label-only suggest.
INSERT INTO dndshare.item (name, name_en, data, type_id, icon_svg_id)
SELECT condition.value,
       NULL,
       jsonb_build_object(
         'code', COALESCE(NULLIF(condition.code, ''), 'condition_' || condition.id::text),
         'legacy_suggest_id', condition.id,
         'desc', COALESCE(condition.desc, ''),
         'polarity', 'negative',
         'color', COALESCE(condition.color, '#e0524e'),
         'stacking', 'single',
         'duration', jsonb_build_object('kind', 'manual')
       ),
       15,
       condition.svg_id
FROM dndshare.suggest condition
WHERE condition.type_id = 9
  AND condition.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM dndshare.item effect
    WHERE effect.type_id = 15
      AND effect.user_id IS NULL
      AND effect.data ->> 'legacy_suggest_id' = condition.id::text
  );

INSERT INTO dndshare.item (name, name_en, data, type_id)
SELECT 'Ярость', 'Rage', '{"code":"rage","desc":"Преимущество на проверки и спасброски Силы, бонус к урону рукопашным оружием Силой и сопротивление дробящему, колющему и рубящему урону.","polarity":"positive","color":"#e0524e","stacking":"single","duration":{"kind":"minutes","value":1},"derived_effects":[{"kind":"roll_mode","mode":"advantage","scopes":["ability_check","skill_check","saving_throw"],"ability_ids":[1],"label":"ярость"},{"kind":"weapon_damage_bonus","value_parameter":"damage_bonus","ability_ids":[1],"weapon_kind":"melee","label":"бонус ярости"}],"defenses":[{"damage_type":1,"kind":"resistance"},{"damage_type":2,"kind":"resistance"},{"damage_type":3,"kind":"resistance"}]}'::jsonb, 15
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'rage'
);

UPDATE dndshare.item
SET data = jsonb_set(data, '{duration}', '{"kind":"minutes","value":1}'::jsonb, true)
WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'rage';

INSERT INTO dndshare.item (name, name_en, data, type_id)
SELECT 'Щит веры', 'Shield of Faith', '{"code":"shield_of_faith","desc":"Бонус +2 к КД на время концентрации.","polarity":"positive","color":"#5aaf72","stacking":"single","duration":{"kind":"minutes","value":10},"concentration":true,"derived_effects":[{"kind":"armor_bonus","value":2,"label":"Щит веры"}]}'::jsonb, 15
WHERE NOT EXISTS (
  SELECT 1 FROM dndshare.item WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'shield_of_faith'
);

UPDATE dndshare.item source
SET data = jsonb_set(
  COALESCE(source.data, '{}'::jsonb),
  '{status_effects}',
  jsonb_build_array(jsonb_build_object(
    'key', 'rage',
    'effect', jsonb_build_object('id', effect.id),
    'parameter_bindings', jsonb_build_array(jsonb_build_object('key', 'damage_bonus', 'source', 'scaling_value'))
  )),
  true
)
FROM dndshare.item effect
WHERE source.type_id = 4
  AND source.user_id IS NULL
  AND lower(source.name) = lower('Ярость')
  AND effect.type_id = 15
  AND effect.user_id IS NULL
  AND effect.data ->> 'code' = 'rage';

UPDATE dndshare.item source
SET data = jsonb_set(
  COALESCE(source.data, '{}'::jsonb),
  '{status_effects}',
  jsonb_build_array(jsonb_build_object(
    'key', 'shield_of_faith',
    'effect', jsonb_build_object('id', effect.id),
    'concentration', true,
    'duration', jsonb_build_object('kind', 'minutes', 'value', 10)
  )),
  true
)
FROM dndshare.item effect
WHERE source.type_id = 5
  AND source.user_id IS NULL
  AND (lower(source.name) = lower('Щит веры') OR lower(COALESCE(source.name_en, '')) = lower('Shield of Faith'))
  AND effect.type_id = 15
  AND effect.user_id IS NULL
  AND effect.data ->> 'code' = 'shield_of_faith';

-- Danger Sense is passive: it marks Dexterity saves without creating an
-- active status. Its textual visibility condition remains in the label.
UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{derived_effects}',
  '[{"kind":"roll_mode","mode":"advantage","scopes":["saving_throw"],"ability_ids":[2],"label":"только против видимого эффекта"}]'::jsonb,
  true
)
WHERE type_id = 4 AND user_id IS NULL AND lower(name) = lower('Опасное чутьё');

-- Convert old suggest ids in values.states to status instances. Structured
-- rows are preserved so the migration is safe on every startup.
WITH rewritten AS (
  SELECT character.id,
         COALESCE(jsonb_agg(mapped.status ORDER BY entry.ordinality)
           FILTER (WHERE mapped.status IS NOT NULL), '[]'::jsonb) AS statuses
  FROM dndshare."char" character
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,states}') = 'array' THEN character.data #> '{values,states}'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS entry(value, ordinality)
  LEFT JOIN LATERAL (
    SELECT CASE
      WHEN jsonb_typeof(entry.value) = 'object' THEN entry.value
      WHEN entry.value #>> '{}' ~ '^[0-9]+$' THEN (
        SELECT jsonb_build_object(
          'uid', 'legacy-state-' || effect.id::text,
          'effect_id', effect.id,
          'source', jsonb_build_object('kind', 'manual'),
          'params', '{}'::jsonb,
          'duration', jsonb_build_object('kind', 'manual'),
          'concentration', false
        )
        FROM dndshare.item effect
        WHERE effect.type_id = 15
          AND effect.data ->> 'legacy_suggest_id' = entry.value #>> '{}'
        ORDER BY effect.id
        LIMIT 1
      )
      ELSE NULL
    END AS status
  ) mapped ON true
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,states}', rewritten.statuses, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,states}' IS DISTINCT FROM rewritten.statuses;

-- Earlier sheets kept Rage in entry.widget_states. Promote active rows to the
-- new source-owned instance so deploying the generic contract does not turn an
-- already active rage off.
WITH rage_config AS (
  SELECT ability.id AS ability_id, effect.id AS effect_id
  FROM dndshare.item ability
  CROSS JOIN dndshare.item effect
  WHERE ability.type_id = 4
    AND ability.user_id IS NULL
    AND lower(ability.name) = lower('Ярость')
    AND effect.type_id = 15
    AND effect.user_id IS NULL
    AND effect.data ->> 'code' = 'rage'
  LIMIT 1
), additions AS (
  SELECT character.id,
         jsonb_agg(jsonb_build_object(
           'uid', 'migrated-rage-' || character.id::text || '-' || entry.ordinality::text,
           'effect_id', rage_config.effect_id,
           'source', jsonb_build_object(
             'kind', 'ability',
             'item_id', rage_config.ability_id,
             'value_id', 'abilities_class',
             'entry_key', COALESCE(NULLIF(entry.value ->> 'uid', ''), entry.value ->> 'id'),
             'link_key', 'rage',
             'label', 'Ярость'
           ),
           'params', jsonb_build_object('damage_bonus', COALESCE((
             SELECT (regexp_match(scaling.value ->> 'value', '[+-]?[0-9]+'))[1]::int
             FROM jsonb_array_elements(COALESCE(ability.data -> 'scaling', '[]'::jsonb)) scaling(value)
             WHERE COALESCE((scaling.value ->> 'level')::int, 0) <= COALESCE((character.data #>> '{values,lvl,level}')::int, 1)
             ORDER BY COALESCE((scaling.value ->> 'level')::int, 0) DESC
             LIMIT 1
           ), 0)),
           'duration', jsonb_build_object('kind', 'minutes', 'value', 1),
           'concentration', false
         )) AS statuses
  FROM dndshare."char" character
  CROSS JOIN rage_config
  JOIN dndshare.item ability ON ability.id = rage_config.ability_id
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,abilities_class}') = 'array' THEN character.data #> '{values,abilities_class}'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY entry(value, ordinality)
  WHERE entry.value #>> '{widget_states,rage}' = 'true'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(CASE
        WHEN jsonb_typeof(character.data #> '{values,states}') = 'array' THEN character.data #> '{values,states}'
        ELSE '[]'::jsonb END
      ) status
      WHERE status ->> 'effect_id' = rage_config.effect_id::text
    )
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(
  character.data,
  '{values,states}',
  CASE WHEN jsonb_typeof(character.data #> '{values,states}') = 'array'
    THEN character.data #> '{values,states}'
    ELSE '[]'::jsonb END || additions.statuses,
  true
)
FROM additions
WHERE character.id = additions.id;

WITH rage AS (
  SELECT id FROM dndshare.item
  WHERE type_id = 15 AND user_id IS NULL AND data ->> 'code' = 'rage'
  LIMIT 1
), rewritten AS (
  SELECT character.id,
         jsonb_agg(
           CASE WHEN status.value ->> 'effect_id' = rage.id::text
             THEN jsonb_set(status.value, '{duration}', '{"kind":"minutes","value":1}'::jsonb, true)
             ELSE status.value
           END
           ORDER BY status.ordinality
         ) AS statuses
  FROM dndshare."char" character
  CROSS JOIN rage
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,states}') = 'array' THEN character.data #> '{values,states}'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY status(value, ordinality)
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,states}', rewritten.statuses, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,states}' IS DISTINCT FROM rewritten.statuses;

UPDATE dndshare.item_type item_type
SET count_items = (SELECT COUNT(*) FROM dndshare.item item WHERE item.type_id = item_type.id AND item.user_id IS NULL)
WHERE item_type.id = 15;
