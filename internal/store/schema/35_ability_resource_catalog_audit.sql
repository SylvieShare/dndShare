-- Complete the finite-use resource contract for racial abilities, class
-- features and feats. The rule table is temporary to this startup transaction:
-- it provides both canonical handbook data and one-time character-entry
-- migration metadata.
CREATE OR REPLACE FUNCTION pg_temp.ability_resource_rules()
RETURNS TABLE(type_id integer, name_ru text, patch jsonb, migration text, legacy_max integer)
LANGUAGE sql
AS $rules$
    VALUES
        -- Racial abilities with independent daily spells.
        (3, 'Дроуская магия', '{"use_resources":[{"key":"faerie_fire","title":"Огненные феи","level":3,"max_use":1,"rollback_long_rest":true},{"key":"darkness","title":"Тьма","level":5,"max_use":1,"rollback_long_rest":true}]}'::jsonb, 'reset', NULL),
        (3, 'Дьявольское наследие', '{"use_resources":[{"key":"hellish_rebuke","title":"Адское возмездие","level":3,"max_use":1,"rollback_long_rest":true},{"key":"darkness","title":"Тьма","level":5,"max_use":1,"rollback_long_rest":true}]}'::jsonb, 'reset', NULL),

        -- Modifier- and class-level-based class resources.
        (4, 'Вдохновение барда', '{"max_use_stat":6,"max_use_min":1,"rollback_long_rest":true,"rollback_short_rest_level":5}'::jsonb, 'manual', NULL),
        (4, 'Гнев бури', '{"max_use_stat":5,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Божественное чувство', '{"max_use_stat":6,"max_use_bonus":1,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Восстанавливающие реагенты', '{"max_use_stat":4,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Жрец войны', '{"max_use_stat":5,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'reset', NULL),
        (4, 'Оберегающая вспышка', '{"max_use_stat":5,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'reset', NULL),
        (4, 'Очищающее касание', '{"max_use_stat":6,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Проблеск гениальности', '{"max_use_stat":4,"max_use_min":1,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Предмет, хранящий заклинания', '{"max_use_stat":4,"max_use_stat_multiplier":2,"max_use_min":2,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Наложение рук', '{"max_use_level_multiplier":5,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Источник магии: очки чародейства', '{"max_use_level_multiplier":1,"rollback_long_rest":true,"short_rest_recovery":4,"short_rest_recovery_level":20}'::jsonb, 'reset', NULL),

        -- Resources whose maximum is already described by scaling[].uses.
        (4, 'Боевое превосходство', '{"max_use_scaling":true,"rollback_short_rest":true,"rollback_long_rest":true}'::jsonb, 'legacy_full', 4),
        (4, 'Божественный канал', '{"max_use_scaling":true,"rollback_short_rest":true,"rollback_long_rest":true}'::jsonb, 'legacy_full', 1),
        (4, 'Всплеск действий', '{"max_use_scaling":true,"rollback_short_rest":true,"rollback_long_rest":true}'::jsonb, 'legacy_full', 1),
        (4, 'Несгибаемость', '{"max_use_scaling":true,"rollback_long_rest":true}'::jsonb, 'legacy_full', 1),
        (4, 'Ци', '{"max_use_scaling":true,"rollback_short_rest":true,"rollback_long_rest":true}'::jsonb, 'manual', NULL),
        (4, 'Ярость', '{"max_use_scaling":true,"rollback_long_rest":true,"scaling":[{"level":1,"uses":2,"value":"+2"},{"level":3,"uses":3,"value":"+2"},{"level":6,"uses":4,"value":"+2"},{"level":9,"uses":4,"value":"+3"},{"level":12,"uses":5,"value":"+3"},{"level":16,"uses":5,"value":"+4"},{"level":17,"uses":6,"value":"+4"},{"level":20,"uses":0,"value":"+4, без ограничений"}]}'::jsonb, 'manual', NULL),
        (4, 'Дикий облик', '{"max_use_scaling":true,"rollback_short_rest":true,"rollback_long_rest":true,"scaling":[{"level":2,"uses":2,"value":"CR 1/4, без скорости плавания и полёта"},{"level":4,"uses":2,"value":"CR 1/2, без скорости полёта"},{"level":8,"uses":2,"value":"CR 1"},{"level":20,"uses":0,"value":"без ограничений"}]}'::jsonb, 'legacy_full', 2),
        (4, 'Знамение', '{"max_use_scaling":true,"rollback_long_rest":true,"scaling":[{"level":2,"uses":2},{"level":14,"uses":3}]}'::jsonb, 'legacy_full', 2),
        (4, 'Опытный эликсир', '{"max_use_scaling":true,"rollback_long_rest":true,"scaling":[{"level":3,"uses":1},{"level":6,"uses":2},{"level":15,"uses":3}]}'::jsonb, 'legacy_full', 1),

        -- Previously unstructured single-use class resources.
        (4, 'Благодатная транспозиция', '{"max_use":1,"rollback_long_rest":true}'::jsonb, 'reset', NULL),

        -- Features containing several independently spent resources.
        (4, 'Подписные заклинания', '{"use_resources":[{"key":"signature_1","title":"Подписное заклинание I","max_use":1,"rollback_short_rest":true,"rollback_long_rest":true},{"key":"signature_2","title":"Подписное заклинание II","max_use":1,"rollback_short_rest":true,"rollback_long_rest":true}]}'::jsonb, 'reset', NULL),
        (4, 'Таинственный арканум', '{"use_resources":[{"key":"arcanum_6","title":"Таинственный арканум: 6 круг","level":11,"max_use":1,"rollback_long_rest":true},{"key":"arcanum_7","title":"Таинственный арканум: 7 круг","level":13,"max_use":1,"rollback_long_rest":true},{"key":"arcanum_8","title":"Таинственный арканум: 8 круг","level":15,"max_use":1,"rollback_long_rest":true},{"key":"arcanum_9","title":"Таинственный арканум: 9 круг","level":17,"max_use":1,"rollback_long_rest":true}]}'::jsonb, 'reset', NULL),
        (4, 'Химическое мастерство', '{"use_resources":[{"key":"greater_restoration","title":"Высшее восстановление","max_use":1,"rollback_long_rest":true},{"key":"heal","title":"Исцеление","max_use":1,"rollback_long_rest":true}]}'::jsonb, 'reset', NULL),

        -- Feats with rest-based charges.
        (7, 'Удачливый', '{"max_use":3,"rollback_long_rest":true}'::jsonb, 'reset', NULL),
        (7, 'Посвящённый в магию', '{"max_use":1,"rollback_long_rest":true}'::jsonb, 'reset', NULL),
        (7, 'Мастер боевых искусств', '{"max_use":1,"rollback_short_rest":true,"rollback_long_rest":true}'::jsonb, 'reset', NULL)
$rules$;

-- Remove every old resource key before applying a canonical rule. This keeps
-- stale manual flags and obsolete fixed maxima from competing with formulas.
UPDATE dndshare.item item
SET data = (
        COALESCE(item.data, '{}'::jsonb)
        - ARRAY[
            'max_use', 'manual_size', 'max_use_stat', 'max_use_min',
            'max_use_stat_multiplier', 'max_use_bonus',
            'max_use_level_multiplier', 'max_use_scaling',
            'rollback_short_rest', 'rollback_long_rest',
            'rollback_short_rest_level', 'short_rest_recovery',
            'short_rest_recovery_level', 'use_resources'
        ]::text[]
    ) || rules.patch
FROM pg_temp.ability_resource_rules() rules
WHERE item.type_id = rules.type_id
  AND item.user_id IS NULL
  AND lower(item.name) = lower(rules.name_ru);

-- Rewrite only legacy counters. resource_version is written by the runtime on
-- every subsequent spend/restore, so restarting the server never refills a
-- legitimately exhausted resource.
WITH canonical AS (
    SELECT item.id, rules.migration, rules.legacy_max
    FROM pg_temp.ability_resource_rules() rules
    JOIN dndshare.item item
      ON item.type_id = rules.type_id
     AND item.user_id IS NULL
     AND lower(item.name) = lower(rules.name_ru)
    WHERE rules.migration <> 'none'
), value_arrays(value_id) AS (
    VALUES ('abilities_race'), ('abilities_class'), ('abilities_feats')
), rewritten_arrays AS (
    SELECT character.id,
           value_arrays.value_id,
           jsonb_agg(
               CASE
                   WHEN canonical.id IS NULL
                     OR COALESCE((entry.value ->> 'resource_version')::integer, 0) >= 1
                       THEN entry.value
                   WHEN canonical.migration = 'reset'
                       THEN (entry.value - 'count' - 'max_use') || '{"resource_version":1}'::jsonb
                   WHEN canonical.migration = 'manual' THEN
                       CASE
                           WHEN entry.value ? 'count'
                            AND entry.value ? 'max_use'
                            AND jsonb_typeof(entry.value -> 'count') = 'number'
                            AND jsonb_typeof(entry.value -> 'max_use') = 'number'
                            AND entry.value -> 'count' = entry.value -> 'max_use'
                               THEN (entry.value - 'count' - 'max_use') || '{"resource_version":1}'::jsonb
                           ELSE (entry.value - 'max_use') || '{"resource_version":1}'::jsonb
                       END
                   WHEN canonical.migration = 'legacy_full' THEN
                       CASE
                           WHEN entry.value ? 'count'
                            AND jsonb_typeof(entry.value -> 'count') = 'number'
                            AND (entry.value ->> 'count')::numeric = canonical.legacy_max
                               THEN (entry.value - 'count' - 'max_use') || '{"resource_version":1}'::jsonb
                           ELSE (entry.value - 'max_use') || '{"resource_version":1}'::jsonb
                       END
                   ELSE entry.value
               END
               ORDER BY entry.ordinal
           ) AS abilities
    FROM dndshare."char" character
    CROSS JOIN value_arrays
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(character.data #> ARRAY['values', value_arrays.value_id]) = 'array'
                THEN character.data #> ARRAY['values', value_arrays.value_id]
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS entry(value, ordinal)
    LEFT JOIN canonical ON entry.value ->> 'id' = canonical.id::text
    GROUP BY character.id, value_arrays.value_id
), rewritten_characters AS (
    SELECT id, jsonb_object_agg(value_id, abilities) AS ability_arrays
    FROM rewritten_arrays
    GROUP BY id
)
UPDATE dndshare."char" character
SET data = jsonb_set(
    character.data,
    '{values}',
    COALESCE(character.data -> 'values', '{}'::jsonb) || rewritten_characters.ability_arrays,
    true
)
FROM rewritten_characters
WHERE character.id = rewritten_characters.id
  AND COALESCE(character.data -> 'values', '{}'::jsonb) || rewritten_characters.ability_arrays
      IS DISTINCT FROM character.data -> 'values';

-- Keep database-backed handbook editors aligned with the readable schemas.
WITH additions(field, ordinal) AS (
    VALUES
        ('{"name":"Множитель модификатора","key":"max_use_stat_multiplier","type":"int","default":1}'::jsonb, 1),
        ('{"name":"Добавка к максимуму","key":"max_use_bonus","type":"int","default":0}'::jsonb, 2),
        ('{"name":"Множитель уровня класса","key":"max_use_level_multiplier","type":"int"}'::jsonb, 3),
        ('{"name":"Использовать uses из прогрессии","key":"max_use_scaling","type":"bool"}'::jsonb, 4),
        ('{"name":"Короткий отдых с уровня","key":"rollback_short_rest_level","type":"int"}'::jsonb, 5),
        ('{"name":"Частично восстановить на коротком отдыхе","key":"short_rest_recovery","type":"int"}'::jsonb, 6),
        ('{"name":"Частичное восстановление с уровня","key":"short_rest_recovery_level","type":"int"}'::jsonb, 7),
        ('{"name":"Несколько независимых ресурсов","key":"use_resources","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Название","key":"title","type":"text"},{"name":"Уровень","key":"level","type":"int"},{"name":"Максимум","key":"max_use","type":"int"},{"name":"Характеристика","key":"max_use_stat","type":"suggest","suggest_id":16},{"name":"Множитель модификатора","key":"max_use_stat_multiplier","type":"int","default":1},{"name":"Добавка","key":"max_use_bonus","type":"int","default":0},{"name":"Минимум","key":"max_use_min","type":"int","default":1},{"name":"Множитель уровня класса","key":"max_use_level_multiplier","type":"int"},{"name":"Короткий отдых","key":"rollback_short_rest","type":"bool"},{"name":"Длинный отдых","key":"rollback_long_rest","type":"bool"}]}'::jsonb, 8)
), missing AS (
    SELECT item_type.id, jsonb_agg(additions.field ORDER BY additions.ordinal) AS fields
    FROM dndshare.item_type item_type
    CROSS JOIN additions
    WHERE item_type.id IN (3, 4, 7)
      AND NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
          WHERE current ->> 'key' = additions.field ->> 'key'
      )
    GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || missing.fields
FROM missing
WHERE item_type.id = missing.id;

DROP FUNCTION pg_temp.ability_resource_rules();
