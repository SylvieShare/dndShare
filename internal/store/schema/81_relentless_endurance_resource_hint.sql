-- The charge and rest icon already communicate the usage limit and recovery.
UPDATE dndshare.item
SET data = jsonb_set(data, '{feature_actions}', (
    SELECT jsonb_agg(CASE WHEN action->>'key' = 'relentless_endurance'
      THEN jsonb_set(action, '{requirements}',
        (action->'requirements') - '1 раз; восстановление после продолжительного отдыха')
      ELSE action END ORDER BY ord)
    FROM jsonb_array_elements(data->'feature_actions') WITH ORDINALITY AS entries(action, ord)
))
WHERE type_id = 3
  AND (name = 'Непоколебимая стойкость' OR name_en = 'Relentless Endurance')
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'feature_actions') action
    WHERE action->>'key' = 'relentless_endurance'
      AND action->'requirements' ? '1 раз; восстановление после продолжительного отдыха'
  );
