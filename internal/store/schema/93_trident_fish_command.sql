-- SRD 5.1, Trident of Fish Command: 3 charges, action costs 1, dawn restores 1d3.
-- Retain the catalogue description, source artwork and unrelated authored mechanics.
UPDATE dndshare.item SET data=data || jsonb_build_object(
  'max_use',3,
  'recharge_note','На рассвете восстановить 1к3 израсходованных заряда, не больше 3. Восстановление отмечается вручную; отдых не заменяет рассвет.',
  'feature_actions',COALESCE(data->'feature_actions','[]'::jsonb) || '[{
    "key":"fish_command","title":"Управление рыбами","action_type":"action",
    "uses_resource":true,"resource_cost":1,
    "description":"<p>Потратьте 1 заряд трезубца, чтобы наложить «Доминирование над зверем» со Сл спасброска 15. Цель — зверь с врождённой скоростью плавания. Примените остальные условия заклинания.</p>",
    "requirements":["Зверь с врождённой скоростью плавания"]
  }]'::jsonb
)
WHERE id=178 AND type_id=19 AND user_id IS NULL AND name='Трезубец управления рыбами'
AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(data->'feature_actions','[]'::jsonb)) action WHERE action->>'key'='fish_command');
