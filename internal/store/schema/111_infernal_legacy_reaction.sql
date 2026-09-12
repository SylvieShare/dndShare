-- The racial spell uses a reaction and shares the existing long-rest charge.
UPDATE dndshare.item
SET data = jsonb_set(data, '{feature_actions}',
    COALESCE(data->'feature_actions', '[]'::jsonb) || $reaction$[{
      "key": "hellish_rebuke",
      "title": "Адское возмездие",
      "action_type": "reaction",
      "level": 3,
      "description": "<p>Наложите «Адское возмездие» 2-го уровня без траты ячейки. Цель совершает спасбросок Ловкости: при провале получает 3к10 урона огнём, при успехе — половину. Сл спасброска = 8 + бонус мастерства + модификатор Харизмы.</p>",
      "requirements": [
        "В ответ на урон от существа, которое вы видите в пределах 60 футов.",
        "Требуются доступная реакция, вербальный и соматический компоненты."
      ],
      "resource_key": "hellish_rebuke",
      "resource_cost": 1,
      "priority": 10
    }]$reaction$::jsonb)
WHERE id = 1443
  AND type_id = 3
  AND user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(data->'feature_actions', '[]'::jsonb)) action
    WHERE action->>'key' = 'hellish_rebuke'
  );
