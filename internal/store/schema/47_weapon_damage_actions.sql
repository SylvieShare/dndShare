-- Abilities, racial traits and feats may contribute an optional weapon-damage
-- action. The weapon menu consumes this contract without knowing the feature's
-- name or id; level scaling and weapon eligibility stay on the handbook item.
WITH addition(field) AS (
  VALUES ('{"name":"Дополнительный урон оружием","key":"weapon_damage","type":"object_array","fields":[{"name":"Название","key":"label","type":"text"},{"name":"Пункт меню","key":"menu_label","type":"text"},{"name":"Пункт меню для крита","key":"critical_menu_label","type":"text"},{"name":"Кость урона","key":"dice","type":"dice"},{"name":"Количество костей","key":"dice_count","type":"int","default":1},{"name":"Делитель уровня для количества","key":"dice_count_level_divisor","type":"int"},{"name":"Округление количества","key":"dice_count_rounding","type":"select","default":"up","options":[{"value":"up","label":"Вверх"},{"value":"down","label":"Вниз"}]},{"name":"Подходящее оружие","key":"weapon_kind","type":"select","default":"any","options":[{"value":"any","label":"Любое"},{"value":"melee","label":"Рукопашное"},{"value":"ranged","label":"Дальнобойное"},{"value":"finesse","label":"Фехтовальное"},{"value":"finesse_or_ranged","label":"Фехтовальное или дальнобойное"}]},{"name":"Удваивать кости при крите","key":"double_on_critical","type":"bool","default":true},{"name":"Раз в ход","key":"once_per_turn","type":"bool"},{"name":"С уровня","key":"level","type":"int","default":1}]}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = COALESCE(item_type.fields, '[]'::jsonb) || jsonb_build_array(addition.field)
FROM addition
WHERE item_type.id IN (3, 4, 7)
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(item_type.fields, '[]'::jsonb)) current
    WHERE current ->> 'key' = 'weapon_damage'
  );

UPDATE dndshare.item
SET data = jsonb_set(
  COALESCE(data, '{}'::jsonb),
  '{weapon_damage}',
  '[{"label":"Скрытая атака","menu_label":"Бросок со Скрытой атакой","critical_menu_label":"Бросок с критической Скрытой атакой","dice":"d6","dice_count_level_divisor":2,"dice_count_rounding":"up","weapon_kind":"finesse_or_ranged","double_on_critical":true,"once_per_turn":true}]'::jsonb,
  true
)
WHERE type_id = 4
  AND user_id IS NULL
  AND lower(name) = lower('Скрытая атака');
