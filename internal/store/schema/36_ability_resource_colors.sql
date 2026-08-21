-- Resource colors belong to their handbook source, not to the shared resource
-- block. Give every built-in finite-use ability a thematic color while keeping
-- the same field available to custom abilities and nested resources.
WITH resource_colors(type_id, name_ru, color) AS (
    VALUES
        (3, 'Оружие дыхания', '#f87171'),

        (4, 'Ангел-мститель', '#fbbf24'),
        (4, 'Благодатная транспозиция', '#38bdf8'),
        (4, 'Боевое превосходство', '#f87171'),
        (4, 'Божественное чувство', '#fbbf24'),
        (4, 'Божественный канал', '#fbbf24'),
        (4, 'Вдохновение барда', '#c084fc'),
        (4, 'Восстанавливающие реагенты', '#2dd4bf'),
        (4, 'Восстановление магии', '#c084fc'),
        (4, 'Восстановление природы', '#4ade80'),
        (4, 'Всплеск действий', '#fbbf24'),
        (4, 'Второе дыхание', '#4ade80'),
        (4, 'Гнев бури', '#38bdf8'),
        (4, 'Дикий облик', '#4ade80'),
        (4, 'Древний чемпион', '#4ade80'),
        (4, 'Жрец войны', '#f87171'),
        (4, 'Знамение', '#818cf8'),
        (4, 'Иллюзорное я', '#c084fc'),
        (4, 'Источник магии: очки чародейства', '#c084fc'),
        (4, 'Корона света', '#fbbf24'),
        (4, 'Наложение рук', '#4ade80'),
        (4, 'Несгибаемость', '#94a3b8'),
        (4, 'Нестареющий страж', '#fbbf24'),
        (4, 'Оберегающая вспышка', '#fbbf24'),
        (4, 'Опытный эликсир', '#2dd4bf'),
        (4, 'Очищающее касание', '#38bdf8'),
        (4, 'Похититель заклинаний', '#c084fc'),
        (4, 'Превращающий', '#2dd4bf'),
        (4, 'Предмет, хранящий заклинания', '#60a5fa'),
        (4, 'Прилив хаоса', '#e879f9'),
        (4, 'Проблеск гениальности', '#fbbf24'),
        (4, 'Священный нимб', '#fbbf24'),
        (4, 'Тёмный бред', '#e879f9'),
        (4, 'Третий глаз', '#818cf8'),
        (4, 'Туманный побег', '#38bdf8'),
        (4, 'Удар удачи', '#fbbf24'),
        (4, 'Удача', '#fbbf24'),
        (4, 'Удача Тёмного', '#fb923c'),
        (4, 'Целостность тела', '#4ade80'),
        (4, 'Ци', '#fbbf24'),
        (4, 'Чародейский владыка', '#c084fc'),
        (4, 'Чарующее присутствие', '#fb7185'),
        (4, 'Швырнуть сквозь ад', '#f87171'),
        (4, 'Энтропийная защита', '#94a3b8'),
        (4, 'Ярость', '#f87171'),

        (7, 'Мастер боевых искусств', '#f87171'),
        (7, 'Посвящённый в магию', '#c084fc'),
        (7, 'Удачливый', '#fbbf24')
)
UPDATE dndshare.item item
SET data = jsonb_set(COALESCE(item.data, '{}'::jsonb), '{resource_color}', to_jsonb(resource_colors.color), true)
FROM resource_colors
WHERE item.type_id = resource_colors.type_id
  AND item.user_id IS NULL
  AND lower(item.name) = lower(resource_colors.name_ru);

-- Composite abilities may use a separate color for every independent counter.
WITH nested_colors(type_id, name_ru, resource_key, color) AS (
    VALUES
        (3, 'Дроуская магия', 'faerie_fire', '#e879f9'),
        (3, 'Дроуская магия', 'darkness', '#818cf8'),
        (3, 'Дьявольское наследие', 'hellish_rebuke', '#f87171'),
        (3, 'Дьявольское наследие', 'darkness', '#818cf8'),
        (4, 'Подписные заклинания', 'signature_1', '#60a5fa'),
        (4, 'Подписные заклинания', 'signature_2', '#c084fc'),
        (4, 'Таинственный арканум', 'arcanum_6', '#c084fc'),
        (4, 'Таинственный арканум', 'arcanum_7', '#818cf8'),
        (4, 'Таинственный арканум', 'arcanum_8', '#38bdf8'),
        (4, 'Таинственный арканум', 'arcanum_9', '#e879f9'),
        (4, 'Химическое мастерство', 'greater_restoration', '#2dd4bf'),
        (4, 'Химическое мастерство', 'heal', '#4ade80')
), rewritten AS (
    SELECT item.id,
           jsonb_agg(
               CASE
                   WHEN nested_colors.color IS NULL THEN resource.value
                   ELSE resource.value || jsonb_build_object('resource_color', nested_colors.color)
               END
               ORDER BY resource.ordinal
           ) AS resources
    FROM dndshare.item item
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(item.data -> 'use_resources') = 'array' THEN item.data -> 'use_resources'
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS resource(value, ordinal)
    LEFT JOIN nested_colors
      ON item.type_id = nested_colors.type_id
     AND lower(item.name) = lower(nested_colors.name_ru)
     AND resource.value ->> 'key' = nested_colors.resource_key
    WHERE item.user_id IS NULL
      AND EXISTS (
          SELECT 1
          FROM nested_colors candidate
          WHERE candidate.type_id = item.type_id
            AND lower(candidate.name_ru) = lower(item.name)
      )
    GROUP BY item.id
)
UPDATE dndshare.item item
SET data = jsonb_set(item.data, '{use_resources}', rewritten.resources, true)
FROM rewritten
WHERE item.id = rewritten.id;

-- Add the configurable color to database-backed handbook editors.
WITH addition AS (
    SELECT '{"name":"Цвет ресурса","key":"resource_color","type":"color"}'::jsonb AS field
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || addition.field
FROM addition
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'resource_color'
  );

WITH rewritten AS (
    SELECT item_type.id,
           jsonb_agg(
        CASE
            WHEN field.value ->> 'key' = 'use_resources'
             AND NOT EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements(COALESCE(field.value -> 'fields', '[]'::jsonb)) nested
                 WHERE nested ->> 'key' = 'resource_color'
             )
                THEN jsonb_set(
                    field.value,
                    '{fields}',
                    COALESCE(field.value -> 'fields', '[]'::jsonb)
                        || '{"name":"Цвет","key":"resource_color","type":"color"}'::jsonb,
                    true
                )
            ELSE field.value
        END
        ORDER BY field.ordinal
    ) AS fields
    FROM dndshare.item_type item_type
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
        WITH ORDINALITY AS field(value, ordinal)
    WHERE item_type.id IN (3, 4, 7)
    GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type
SET fields = rewritten.fields
FROM rewritten
WHERE item_type.id = rewritten.id
  AND item_type.fields IS DISTINCT FROM rewritten.fields;
