-- One linked adjustment of weapon attack/damage bonus and owner AC; no resource cost.
UPDATE dndshare.item_type SET fields=fields || jsonb_build_array($transfer_field${"key": "weapon_bonus_transfer", "name": "Перенос бонуса оружия в защиту", "type": "object", "fields": [{"key": "title", "name": "Название в меню атаки", "type": "text", "default": "Перенести в защиту", "hint": "Пункт в меню атаки с ячейками выбора количества. Это выбор бонуса, а не расход зарядов."}, {"key": "condition", "name": "Когда можно переносить", "type": "text", "hint": "Условие выбора для игрока. Начало и конец хода не отслеживаются: игрок сбрасывает перенос кнопкой под оружием."}]}$transfer_field$::jsonb)
WHERE id=19 AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='weapon_bonus_transfer');

UPDATE dndshare.item SET data=jsonb_set(data,'{weapon_bonus_transfer}',
 '{"title":"Перенести в защиту","condition":"При первой атаке этим мечом в своём ходу. До начала следующего своего хода, пока держите меч. Сбросьте перенос вручную."}'::jsonb)
WHERE id=233 AND name='Защитник' AND type_id=19 AND user_id IS NULL AND NOT data ? 'weapon_bonus_transfer';
