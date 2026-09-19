-- Unify the capability; the original potion catalogue and inventory shelf remain.
ALTER TABLE dndshare.item_application ADD COLUMN source text NOT NULL DEFAULT 'potions';
ALTER TABLE dndshare.item_transfer DROP CONSTRAINT item_transfer_use_source;
ALTER TABLE dndshare.item_transfer ADD CONSTRAINT item_transfer_use_source CHECK(purpose <> 'use' OR source IN ('potions','spells','items','weapon'));
UPDATE dndshare.item SET data=(data - 'consumption') || jsonb_build_object('usable',COALESCE(data->'usable',data->'consumption','{}'::jsonb)) WHERE data ? 'consumption' OR type_id=10;
UPDATE dndshare.item SET data=jsonb_set(data - 'status_effects','{usable,status_effects}',data->'status_effects') WHERE type_id=10 AND data ? 'status_effects';
UPDATE dndshare.item_type SET fields=(SELECT COALESCE(jsonb_agg(f ORDER BY ord),'[]'::jsonb) FROM jsonb_array_elements(fields) WITH ORDINALITY a(f,ord) WHERE f->>'key' NOT IN ('consumption','usable') AND NOT (id=10 AND f->>'key'='status_effects')) WHERE id IN (1,2,10,12,13,14,19);
UPDATE dndshare.item_type SET fields=fields || jsonb_build_array(
'{
  "key": "usable",
  "name": "Применение предмета",
  "type": "object",
  "optional": true,
  "fields": [
    {
      "key": "healing",
      "name": "Восстановление хитов",
      "type": "text",
      "hint": "Формула, например 2d4 + 2. Хиты восстанавливаются до максимума."
    },
    {
      "key": "temporary_hp",
      "name": "Временные хиты",
      "type": "text",
      "hint": "Формула или число. Сохраняется большее значение, временные хиты не складываются."
    },
    {
      "key": "spell",
      "name": "Эффект заклинания",
      "type": "item",
      "item_type": 5
    },
    {
      "key": "spell_effect_key",
      "name": "Вариант эффекта заклинания",
      "type": "text",
      "hint": "Ключ связанного эффекта. Пусто — применить все эффекты заклинания."
    },
    {
      "key": "duration",
      "name": "Длительность",
      "type": "object",
      "fields": [
        {
          "key": "kind",
          "name": "Вид",
          "type": "select",
          "default": "manual",
          "options": [
            {
              "label": "До ручного снятия",
              "value": "manual"
            },
            {
              "label": "Раунды",
              "value": "rounds"
            },
            {
              "label": "Минуты",
              "value": "minutes"
            },
            {
              "label": "Часы",
              "value": "hours"
            },
            {
              "label": "До отдыха",
              "value": "until_rest"
            },
            {
              "label": "Постоянно",
              "value": "permanent"
            }
          ]
        },
        {
          "key": "value",
          "name": "Значение",
          "type": "int"
        },
        {
          "key": "formula",
          "name": "Случайная длительность",
          "type": "text",
          "hint": "Например 1d4. Бросается при применении вместо постоянного значения."
        }
      ],
      "optional": true
    },
    {
      "key": "concentration",
      "name": "Требует концентрации",
      "type": "bool"
    },
    {
      "key": "note",
      "name": "Что нужно учесть вручную",
      "type": "text"
    },
    {
      "key": "choices",
      "name": "Варианты применения",
      "type": "object_array",
      "fields": [
        {
          "key": "key",
          "name": "Ключ варианта",
          "type": "text"
        },
        {
          "key": "name",
          "name": "Название варианта",
          "type": "text"
        },
        {
          "key": "status_effects",
          "name": "Связанные эффекты",
          "type": "object_array",
          "fields": [
            {
              "key": "key",
              "name": "Ключ",
              "type": "text"
            },
            {
              "key": "effect",
              "name": "Эффект",
              "type": "item",
              "item_type": 15
            },
            {
              "key": "parameter_bindings",
              "name": "Параметры",
              "type": "object_array",
              "fields": [
                {
                  "key": "key",
                  "name": "Параметр",
                  "type": "text"
                },
                {
                  "key": "source",
                  "name": "Источник",
                  "type": "select",
                  "options": [
                    {
                      "label": "Текущее значение прогрессии",
                      "value": "scaling_value"
                    },
                    {
                      "label": "Постоянное значение",
                      "value": "fixed"
                    }
                  ]
                },
                {
                  "key": "value",
                  "name": "Значение",
                  "type": "int"
                }
              ]
            },
            {
              "key": "concentration",
              "name": "Концентрация",
              "type": "bool"
            },
            {
              "key": "duration",
              "name": "Длительность",
              "type": "object",
              "fields": [
                {
                  "key": "kind",
                  "name": "Вид",
                  "type": "select",
                  "default": "manual",
                  "options": [
                    {
                      "label": "До ручного снятия",
                      "value": "manual"
                    },
                    {
                      "label": "Раунды",
                      "value": "rounds"
                    },
                    {
                      "label": "Минуты",
                      "value": "minutes"
                    },
                    {
                      "label": "Часы",
                      "value": "hours"
                    },
                    {
                      "label": "До отдыха",
                      "value": "until_rest"
                    },
                    {
                      "label": "Постоянно",
                      "value": "permanent"
                    }
                  ]
                },
                {
                  "key": "value",
                  "name": "Значение",
                  "type": "int"
                },
                {
                  "key": "formula",
                  "name": "Случайная длительность",
                  "type": "text",
                  "hint": "Например 1d4. Бросается при применении вместо постоянного значения."
                }
              ]
            },
            {
              "key": "target",
              "name": "На кого накладывается",
              "type": "select",
              "default": "self",
              "options": [
                {
                  "value": "self",
                  "label": "На владельца"
                },
                {
                  "value": "other",
                  "label": "На другое существо"
                }
              ],
              "hint": "Эффект на другое существо не включается на листе владельца предмета."
            },
            {
              "key": "condition",
              "name": "Условие наложения",
              "type": "text",
              "hint": "Укажите попадание, спасбросок и другие условия, которые проверяет игрок."
            },
            {
              "key": "weapon_damage_key",
              "name": "Связанный дополнительный урон",
              "type": "text",
              "hint": "Переключатель урона этого предмета. Связь поясняет условие, но не накладывает эффект автоматически."
            }
          ]
        }
      ]
    },
    {
      "key": "status_effects",
      "name": "Связанные эффекты",
      "type": "object_array",
      "fields": [
        {
          "key": "key",
          "name": "Ключ",
          "type": "text"
        },
        {
          "key": "effect",
          "name": "Эффект",
          "type": "item",
          "item_type": 15
        },
        {
          "key": "parameter_bindings",
          "name": "Параметры",
          "type": "object_array",
          "fields": [
            {
              "key": "key",
              "name": "Параметр",
              "type": "text"
            },
            {
              "key": "source",
              "name": "Источник",
              "type": "select",
              "options": [
                {
                  "label": "Текущее значение прогрессии",
                  "value": "scaling_value"
                },
                {
                  "label": "Постоянное значение",
                  "value": "fixed"
                }
              ]
            },
            {
              "key": "value",
              "name": "Значение",
              "type": "int"
            }
          ]
        },
        {
          "key": "concentration",
          "name": "Концентрация",
          "type": "bool"
        },
        {
          "key": "duration",
          "name": "Длительность",
          "type": "object",
          "fields": [
            {
              "key": "kind",
              "name": "Вид",
              "type": "select",
              "default": "manual",
              "options": [
                {
                  "label": "До ручного снятия",
                  "value": "manual"
                },
                {
                  "label": "Раунды",
                  "value": "rounds"
                },
                {
                  "label": "Минуты",
                  "value": "minutes"
                },
                {
                  "label": "Часы",
                  "value": "hours"
                },
                {
                  "label": "До отдыха",
                  "value": "until_rest"
                },
                {
                  "label": "Постоянно",
                  "value": "permanent"
                }
              ]
            },
            {
              "key": "value",
              "name": "Значение",
              "type": "int"
            },
            {
              "key": "formula",
              "name": "Случайная длительность",
              "type": "text",
              "hint": "Например 1d4. Бросается при применении вместо постоянного значения."
            }
          ]
        },
        {
          "key": "target",
          "name": "На кого накладывается",
          "type": "select",
          "default": "self",
          "options": [
            {
              "value": "self",
              "label": "На владельца"
            },
            {
              "value": "other",
              "label": "На другое существо"
            }
          ],
          "hint": "Эффект на другое существо не включается на листе владельца предмета."
        },
        {
          "key": "condition",
          "name": "Условие наложения",
          "type": "text",
          "hint": "Укажите попадание, спасбросок и другие условия, которые проверяет игрок."
        },
        {
          "key": "weapon_damage_key",
          "name": "Связанный дополнительный урон",
          "type": "text",
          "hint": "Переключатель урона этого предмета. Связь поясняет условие, но не накладывает эффект автоматически."
        }
      ]
    }
  ]
}'::jsonb) WHERE id IN (1,2,10,12,13,14,19);
