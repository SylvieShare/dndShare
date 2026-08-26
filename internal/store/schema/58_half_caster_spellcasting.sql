-- Half-casters have slots only after level 1, but from that point onward they
-- must participate in the same spell-source contract as every other class.
-- Names are used only by this startup catalogue migration; runtime consumes
-- the explicit spellcasting object and start_level.

WITH additions(fields) AS (
  VALUES ('[{"name":"Уровень начала заклинательства","key":"start_level","type":"int","default":1},{"name":"Режим выбора на повышении","key":"selection_mode","type":"select","options":[{"value":"known","label":"Известные заклинания"},{"value":"prepared","label":"Подготавливаемые заклинания"},{"value":"spellbook","label":"Книга заклинаний"}]},{"name":"Новых заклинаний за уровень","key":"level_up_choices","type":"int"}]'::jsonb)
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
    SELECT 1
    FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) subfield
    WHERE field ->> 'key' = 'spellcasting' AND subfield ->> 'key' = 'start_level'
  );

WITH rules(name_en, ability, prepares, selection_mode, note) AS (
  VALUES
    ('Paladin', 6, true, 'prepared', 'Подготавливает заклинания паладина начиная со 2 уровня.'),
    ('Ranger', 5, false, 'known', 'Изучает заклинания следопыта начиная со 2 уровня.')
)
UPDATE dndshare.item item
SET data = jsonb_set(
  COALESCE(item.data, '{}'::jsonb),
  '{spellcasting}',
  COALESCE(item.data -> 'spellcasting', '{}'::jsonb) || jsonb_build_object(
    'ability', rules.ability,
    'progression', item.data ->> 'caster_progression',
    'list_class', jsonb_build_object('id', item.id),
    'start_level', 2,
    'prepares', rules.prepares,
    'selection_mode', rules.selection_mode,
    'note', rules.note
  ),
  true
)
FROM rules
WHERE item.type_id = 9
  AND item.user_id IS NULL
  AND lower(item.name_en) = lower(rules.name_en);

UPDATE dndshare.item
SET data = jsonb_set(data, '{spellcasting,selection_mode}', '"spellbook"'::jsonb, true)
WHERE type_id = 9 AND user_id IS NULL AND lower(name_en) = lower('Wizard');

UPDATE dndshare.item
SET data = jsonb_set(data, '{spellcasting,level_up_choices}', '2'::jsonb, true)
WHERE type_id = 9 AND user_id IS NULL AND lower(name_en) = lower('Wizard');
