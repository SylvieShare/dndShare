-- Relentless Endurance is an optional triggered use, not an action or reaction.
-- Bind its existing resource so the sheet shows the charge in Special Actions.
UPDATE dndshare.item
SET data = jsonb_set(data, '{feature_actions}',
    COALESCE(data->'feature_actions', '[]'::jsonb) || '[{
      "key": "relentless_endurance",
      "title": "Непоколебимая стойкость",
      "action_type": "special",
      "description": "Когда ваши хиты опускаются до 0, но вы не убиты мгновенно, вы можете вместо этого остаться с 1 хитом. Не требует действия или реакции. Повторное использование — после продолжительного отдыха.",
      "requirements": ["Хиты опускаются до 0, но вы не убиты мгновенно"],
      "uses_resource": true,
      "resource_cost": 1,
      "priority": 10
    }]'::jsonb)
WHERE type_id = 3
  AND (name = 'Непоколебимая стойкость' OR name_en = 'Relentless Endurance')
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(data->'feature_actions', '[]'::jsonb)) action
    WHERE action->>'key' = 'relentless_endurance'
  );
