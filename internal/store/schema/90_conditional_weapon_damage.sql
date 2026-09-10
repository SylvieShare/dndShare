-- Extend the common conditional-damage contract without changing existing rules.
UPDATE dndshare.item_type SET fields=(
  SELECT jsonb_agg(CASE WHEN field->>'key'='weapon_damage'
    THEN jsonb_set(field, '{fields}', $fields$[
  {
    "name": "Условие применения",
    "key": "condition",
    "type": "text",
    "hint": "Кратко укажите, когда игрок может включить этот урон. Показывается в меню оружия и справочнике."
  },
  {
    "name": "Способ атаки",
    "key": "attack_mode",
    "type": "select",
    "options": [
      {
        "value": "thrown",
        "label": "Бросок оружия"
      }
    ],
    "hint": "Бросок сохраняет характеристику оружия, но считается дальней атакой и не использует хват двумя руками.",
    "emptyLabel": "Не меняется"
  },
  {
    "name": "Требует переключателя",
    "key": "requires_damage_key",
    "type": "text",
    "hint": "Ключ другого правила дополнительного урона того же предмета. В редакторе выбирается по названию."
  }
]$fields$::jsonb || (field->'fields'))
    ELSE field END ORDER BY ord)
  FROM jsonb_array_elements(fields) WITH ORDINALITY f(field,ord)
) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='weapon_damage');

-- Each switch adds one die: throw = +1d8; throw against a giant = +2d8 total.
UPDATE dndshare.item SET data=jsonb_set(data, '{weapon_damage}', '[
  {"key":"throw","label":"Бросок","condition":"При попадании брошенным молотом.","attack_mode":"thrown","dice":"d8","dice_count":1,"double_on_critical":true},
  {"key":"giant","label":"Цель — великан","condition":"При броске по великану: ещё 1к8, всего +2к8.","requires_damage_key":"throw","dice":"d8","dice_count":1,"double_on_critical":true}
]'::jsonb)
WHERE id=261 AND type_id=19 AND user_id IS NULL AND name='Дварфийский метатель';
