-- Class tool proficiencies can be a concrete pick instead of a static broad
-- grant. Bard chooses three distinct musical instruments in PHB 2014; the
-- generic "Музыкальные инструменты" suggest is a category, not that choice.

WITH field AS (
    SELECT '{"name":"Выбор владений инструментами","key":"tool_prof_choice","type":"object","fields":[{"name":"Количество","key":"count","type":"int","default":1},{"name":"Из владений","key":"from","type":"suggest_array","suggest_id":5}]}'::jsonb AS value
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(field.value)
FROM field
WHERE item_type.id = 9
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
      WHERE current ->> 'key' = 'tool_prof_choice'
  );

WITH musical AS (
    SELECT jsonb_agg(suggest.id ORDER BY suggest.value, suggest.id) AS ids
    FROM dndshare.suggest suggest
    WHERE suggest.type_id = 5
      AND suggest.user_id IS NULL
      AND suggest.code LIKE 'tool-music-%'
)
UPDATE dndshare.item class
SET data = (class.data - 'tool_prof') || jsonb_build_object(
    'tool_prof_choice', jsonb_build_object(
        'count', 3,
        'from', musical.ids
    )
)
FROM musical
WHERE class.user_id IS NULL
  AND class.type_id = 9
  AND lower(btrim(class.name)) = lower('Бард')
  AND jsonb_array_length(COALESCE(musical.ids, '[]'::jsonb)) = 10;
