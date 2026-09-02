-- Class-level pools are independent of individual feature cards. Several
-- classes may contribute ways to spend the same pool without adding their
-- charges together (D&D 5e 2014 multiclass Channel Divinity).
WITH addition(field) AS (
  VALUES ('{"name":"Общие ресурсы класса","key":"class_resources","type":"object_array","fields":[{"name":"Ключ","key":"key","type":"text"},{"name":"Название","key":"title","type":"text"},{"name":"С уровня","key":"level","type":"int","default":1},{"name":"Максимум","key":"max_use","type":"int"},{"name":"Прогрессия","key":"scaling","type":"object_array","fields":[{"name":"Уровень","key":"level","type":"int"},{"name":"Использований","key":"uses","type":"int"}]},{"name":"После короткого отдыха","key":"rollback_short_rest","type":"bool"},{"name":"После продолжительного отдыха","key":"rollback_long_rest","type":"bool"},{"name":"Цвет","key":"resource_color","type":"color"}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || addition.field
FROM addition
WHERE item_type.id = 9
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'class_resources'
  );

WITH addition(field) AS (
  VALUES ('{"name":"Ключ общего ресурса","key":"resource_pool_key","type":"text"}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN row_field.field ->> 'key' = 'feature_actions' THEN jsonb_set(
      row_field.field,
      '{fields}',
      COALESCE(row_field.field -> 'fields', '[]'::jsonb) || jsonb_build_array(addition.field),
      true
    ) ELSE row_field.field END
    ORDER BY row_field.ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
  CROSS JOIN addition
)
WHERE item_type.id IN (3, 4, 7)
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(item_type.fields) field
    WHERE field ->> 'key' = 'feature_actions'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) nested
    WHERE field ->> 'key' = 'feature_actions'
      AND nested ->> 'key' = 'resource_pool_key'
  );

WITH class_rules(class_id, resource) AS (
  VALUES
    (4020::bigint, '{"key":"channel_divinity","title":"Божественный канал","level":2,"max_use":1,"scaling":[{"level":2,"uses":1},{"level":6,"uses":2},{"level":18,"uses":3}],"rollback_short_rest":true,"rollback_long_rest":true,"resource_color":"#fbbf24"}'::jsonb),
    (4021::bigint, '{"key":"channel_divinity","title":"Божественный канал","level":3,"max_use":1,"rollback_short_rest":true,"rollback_long_rest":true,"resource_color":"#fbbf24"}'::jsonb)
)
UPDATE dndshare.item class_item
SET data = jsonb_set(COALESCE(class_item.data, '{}'::jsonb), '{class_resources}', jsonb_build_array(class_rules.resource), true)
FROM class_rules
WHERE class_item.id = class_rules.class_id
  AND class_item.type_id = 9
  AND class_item.user_id IS NULL;

-- Preserve the available cleric counter before the old feature-owned resource
-- is retired. Characters without a stored count keep the live full default.
WITH channel_item AS (
  SELECT item.id
  FROM dndshare.item item
  WHERE item.type_id = 4
    AND item.user_id IS NULL
    AND (lower(COALESCE(item.name_en, '')) = lower('Channel Divinity') OR lower(item.name) = lower('Божественный канал'))
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(item.data -> 'class_ids', '[]'::jsonb)) class_ref
      WHERE (class_ref ->> 'id')::bigint = 4020
    )
  ORDER BY item.id
  LIMIT 1
), legacy_counts AS (
  SELECT character.id,
         MIN(GREATEST(0, (entry.value ->> 'count')::integer)) AS available
  FROM dndshare."char" character
  CROSS JOIN channel_item
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,abilities_class}') = 'array' THEN character.data #> '{values,abilities_class}'
    ELSE '[]'::jsonb END
  ) entry(value)
  WHERE entry.value ->> 'id' = channel_item.id::text
    AND jsonb_typeof(entry.value -> 'count') = 'number'
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(
  character.data,
  '{values}',
  COALESCE(character.data -> 'values', '{}'::jsonb) || jsonb_build_object(
    'class_resource_counts',
    COALESCE(character.data #> '{values,class_resource_counts}', '{}'::jsonb)
      || jsonb_build_object('channel_divinity', legacy_counts.available)
  ),
  true
)
FROM legacy_counts
WHERE character.id = legacy_counts.id
  AND NOT (COALESCE(character.data #> '{values,class_resource_counts}', '{}'::jsonb) ? 'channel_divinity');

WITH channel_item AS (
  SELECT item.id
  FROM dndshare.item item
  WHERE item.type_id = 4
    AND item.user_id IS NULL
    AND (lower(COALESCE(item.name_en, '')) = lower('Channel Divinity') OR lower(item.name) = lower('Божественный канал'))
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(COALESCE(item.data -> 'class_ids', '[]'::jsonb)) class_ref
      WHERE (class_ref ->> 'id')::bigint = 4020
    )
  ORDER BY item.id
  LIMIT 1
), rewritten AS (
  SELECT character.id,
         jsonb_agg(
           CASE WHEN entry.value ->> 'id' = channel_item.id::text
             THEN entry.value - ARRAY['count', 'max_use', 'resource_counts', 'resource_version']::text[]
             ELSE entry.value
           END
           ORDER BY entry.ordinal
         ) AS abilities
  FROM dndshare."char" character
  CROSS JOIN channel_item
  CROSS JOIN LATERAL jsonb_array_elements(CASE
    WHEN jsonb_typeof(character.data #> '{values,abilities_class}') = 'array' THEN character.data #> '{values,abilities_class}'
    ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS entry(value, ordinal)
  GROUP BY character.id
)
UPDATE dndshare."char" character
SET data = jsonb_set(character.data, '{values,abilities_class}', rewritten.abilities, true)
FROM rewritten
WHERE character.id = rewritten.id
  AND character.data #> '{values,abilities_class}' IS DISTINCT FROM rewritten.abilities;

-- The old cleric feature remains the source of Turn Undead, but the shared
-- class pool now owns its counter and rest rules.
UPDATE dndshare.item item
SET data = COALESCE(item.data, '{}'::jsonb) - ARRAY[
  'max_use', 'manual_size', 'max_use_stat', 'max_use_min',
  'max_use_stat_multiplier', 'max_use_bonus', 'max_use_level_multiplier',
  'max_use_scaling', 'rollback_short_rest', 'rollback_long_rest',
  'rollback_short_rest_level', 'short_rest_recovery',
  'short_rest_recovery_level', 'use_resources', 'resource_color'
]::text[]
WHERE item.type_id = 4
  AND item.user_id IS NULL
  AND (lower(COALESCE(item.name_en, '')) = lower('Channel Divinity') OR lower(item.name) = lower('Божественный канал'))
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(item.data -> 'class_ids', '[]'::jsonb)) class_ref
    WHERE (class_ref ->> 'id')::bigint = 4020
  );

WITH action_targets(class_id, name_identity) AS (
  VALUES
    (4020::bigint, 'Channel Divinity'),
    (4020::bigint, 'Preserve Life'),
    (4020::bigint, 'Radiance of the Dawn'),
    (4020::bigint, 'Charm Animals and Plants'),
    (4020::bigint, 'Invoke Duplicity'),
    (4020::bigint, 'Knowledge of the Ages'),
    (4020::bigint, 'Cloak of Shadows'),
    (4021::bigint, 'Nature''s Wrath'),
    (4021::bigint, 'Turn the Faithless'),
    (4021::bigint, 'Turn the Unholy'),
    (4021::bigint, 'Abjure Enemy'),
    (4021::bigint, 'Vow of Enmity'),
    (4021::bigint, 'Sacred Weapon')
)
UPDATE dndshare.item target
SET data = jsonb_set(
  COALESCE(target.data, '{}'::jsonb),
  '{feature_actions}',
  COALESCE((
    SELECT jsonb_agg(
      (CASE WHEN action_targets.class_id = 4021
        THEN action.value - ARRAY['uses_resource', 'resource_item_id', 'requirements']::text[]
        ELSE action.value - ARRAY['uses_resource', 'resource_item_id']::text[]
      END) || '{"resource_pool_key":"channel_divinity","resource_cost":1}'::jsonb
      ORDER BY action.ordinal
    )
    FROM jsonb_array_elements(COALESCE(target.data -> 'feature_actions', '[]'::jsonb)) WITH ORDINALITY action(value, ordinal)
  ), '[]'::jsonb),
  true
)
FROM action_targets
WHERE target.type_id = 4
  AND target.user_id IS NULL
  AND (
    lower(COALESCE(target.name_en, '')) = lower(action_targets.name_identity)
    OR lower(target.name) = lower(action_targets.name_identity)
  )
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(target.data -> 'class_ids', '[]'::jsonb)) class_ref
    WHERE (class_ref ->> 'id')::bigint = action_targets.class_id
  );
