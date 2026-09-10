-- Keep the effect in the summary and display usage details as bullet points.
UPDATE dndshare.item
SET data = jsonb_set(data, '{feature_actions}', (
    SELECT jsonb_agg(CASE WHEN action->>'key' = 'relentless_endurance'
      THEN action || jsonb_build_object(
        'description', 'При падении хитов до 0 можете остаться с 1 хитом.',
        'requirements', jsonb_build_array(
          'Только если вы не убиты мгновенно',
          'Не требует действия или реакции',
          '1 раз; восстановление после продолжительного отдыха'
        )
      )
      ELSE action END ORDER BY ord)
    FROM jsonb_array_elements(data->'feature_actions') WITH ORDINALITY AS entries(action, ord)
))
WHERE type_id = 3
  AND (name = 'Непоколебимая стойкость' OR name_en = 'Relentless Endurance')
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(data->'feature_actions') action
    WHERE action->>'key' = 'relentless_endurance'
  );
