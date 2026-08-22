-- Race abilities, class abilities and feats use the same repeatable choice
-- contract. Replace the historical single `choice` object on ability types
-- with the canonical `choices` array used by feats.
WITH rewritten AS (
    SELECT item_type.id,
           COALESCE(jsonb_agg(field.value ORDER BY field.ordinality)
               FILTER (WHERE field.value ->> 'key' <> 'choice'), '[]'::jsonb) AS fields
    FROM dndshare.item_type item_type
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb))
        WITH ORDINALITY AS field(value, ordinality)
    WHERE item_type.id IN (3, 4)
    GROUP BY item_type.id
)
UPDATE dndshare.item_type item_type
SET fields = rewritten.fields
FROM rewritten
WHERE item_type.id = rewritten.id
  AND item_type.fields IS DISTINCT FROM rewritten.fields;

WITH choice_field AS (
    SELECT '{"name":"Выборы при получении","key":"choices","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Подсказка игроку","key":"text","type":"text"},{"name":"Сколько выбрать","key":"count","type":"int","default":1},{"name":"Источник вариантов","key":"source","type":"select","default":"inline","options":[{"value":"inline","label":"Варианты ниже"},{"value":"suggest","label":"Словарь"},{"value":"item","label":"Предметы справочника"}]},{"name":"ID словаря","key":"from_suggest_id","type":"int","show_on":{"key":"source","value":"suggest"}},{"name":"ID типа предметов","key":"from_item_type_id","type":"int","show_on":{"key":"source","value":"item"}},{"name":"Фильтр предметов","key":"item_filter","type":"text","show_on":{"key":"source","value":"item"}},{"name":"Не повторять вариант","key":"unique_across_takes","type":"bool"},{"name":"Варианты","key":"options","type":"object_array","show_on":{"key":"source","value":"inline"},"fields":[{"name":"Значение","key":"value","type":"text"},{"name":"Название","key":"label","type":"text"},{"name":"Описание","key":"desc","type":"text"}]}]}'::jsonb AS value
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(choice_field.value)
FROM choice_field
WHERE item_type.id IN (3, 4)
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) field
      WHERE field ->> 'key' = 'choices'
  );

UPDATE dndshare.item
SET data = CASE
    WHEN jsonb_typeof(data -> 'choices') = 'array' THEN data - 'choice'
    WHEN jsonb_typeof(data -> 'choice') = 'object' THEN
        (data - 'choice') || jsonb_build_object(
            'choices',
            jsonb_build_array(jsonb_build_object('key', 'choice') || (data -> 'choice'))
        )
    ELSE data - 'choice'
END
WHERE type_id IN (3, 4)
  AND data ? 'choice';

-- Older creation/level-up flows stored a single selection only in the flat
-- `feature_choices` map. Copy it onto the owned ability entry as the canonical
-- `choices.choice` value while retaining the old map for spell-grant matching.
WITH rewritten AS (
    SELECT character.id,
           bucket.name,
           jsonb_agg(
               CASE
                   WHEN entry.value ? 'choices' THEN entry.value
                   WHEN feature_choices ? (entry.value ->> 'id') THEN
                       entry.value || jsonb_build_object(
                           'choices',
                           jsonb_build_object('choice', feature_choices -> (entry.value ->> 'id'))
                       )
                   ELSE entry.value
               END
               ORDER BY entry.ordinality
           ) AS abilities
    FROM dndshare."char" character
    CROSS JOIN (VALUES ('abilities_race'), ('abilities_class')) AS bucket(name)
    CROSS JOIN LATERAL (
        SELECT COALESCE(character.data #> '{values,feature_choices}', '{}'::jsonb)
    ) AS saved(feature_choices)
    CROSS JOIN LATERAL jsonb_array_elements(
        CASE
            WHEN jsonb_typeof(character.data #> ARRAY['values', bucket.name]) = 'array'
                THEN character.data #> ARRAY['values', bucket.name]
            ELSE '[]'::jsonb
        END
    ) WITH ORDINALITY AS entry(value, ordinality)
    WHERE jsonb_typeof(saved.feature_choices) = 'object'
    GROUP BY character.id, bucket.name
), merged AS (
    SELECT id, jsonb_object_agg(name, abilities) AS buckets
    FROM rewritten
    GROUP BY id
)
UPDATE dndshare."char" character
SET data = jsonb_set(
    jsonb_set(
        character.data,
        '{values,abilities_race}',
        COALESCE(merged.buckets -> 'abilities_race', character.data #> '{values,abilities_race}', '[]'::jsonb),
        true
    ),
    '{values,abilities_class}',
    COALESCE(merged.buckets -> 'abilities_class', character.data #> '{values,abilities_class}', '[]'::jsonb),
    true
)
FROM merged
WHERE character.id = merged.id
  AND character.data IS DISTINCT FROM jsonb_set(
      jsonb_set(
          character.data,
          '{values,abilities_race}',
          COALESCE(merged.buckets -> 'abilities_race', character.data #> '{values,abilities_race}', '[]'::jsonb),
          true
      ),
      '{values,abilities_class}',
      COALESCE(merged.buckets -> 'abilities_class', character.data #> '{values,abilities_class}', '[]'::jsonb),
      true
  );
