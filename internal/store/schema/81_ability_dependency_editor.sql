-- Complete the authoring contract for existing choice and derived-effect mechanics.
WITH patch AS (SELECT $dependency_fields${
  "choices": {
    "name": "Выборы при получении",
    "key": "choices",
    "type": "object_array",
    "fields": [
      {
        "name": "Ключ",
        "key": "key",
        "type": "text"
      },
      {
        "name": "Подсказка игроку",
        "key": "text",
        "type": "text"
      },
      {
        "name": "Сколько выбрать",
        "key": "count",
        "type": "int",
        "default": 1
      },
      {
        "name": "Источник вариантов",
        "key": "source",
        "type": "select",
        "default": "inline",
        "options": [
          {
            "label": "Варианты ниже",
            "value": "inline"
          },
          {
            "label": "Словарь",
            "value": "suggest"
          },
          {
            "label": "Предметы справочника",
            "value": "item"
          },
          {
            "value": "suggest_union",
            "label": "Несколько словарей вместе"
          }
        ]
      },
      {
        "name": "ID словаря",
        "key": "from_suggest_id",
        "type": "int",
        "show_on": {
          "key": "source",
          "value": "suggest"
        }
      },
      {
        "name": "ID типа предметов",
        "key": "from_item_type_id",
        "type": "int",
        "show_on": {
          "key": "source",
          "value": "item"
        }
      },
      {
        "name": "Фильтр предметов",
        "key": "item_filter",
        "type": "text",
        "show_on": {
          "key": "source",
          "value": "item"
        }
      },
      {
        "name": "Не повторять вариант",
        "key": "unique_across_takes",
        "type": "bool"
      },
      {
        "name": "Добавить выбранные заклинания",
        "key": "grant_spells",
        "type": "bool"
      },
      {
        "name": "Характеристика заклинаний",
        "key": "casting_ability",
        "type": "suggest",
        "suggest_id": 16,
        "show_on": {
          "key": "grant_spells",
          "value": true
        }
      },
      {
        "name": "Без расхода ячейки",
        "key": "slotless",
        "type": "bool",
        "show_on": {
          "key": "grant_spells",
          "value": true
        }
      },
      {
        "name": "С уровня",
        "key": "level",
        "type": "int",
        "default": 1
      },
      {
        "name": "Варианты",
        "key": "options",
        "type": "object_array",
        "show_on": {
          "key": "source",
          "value": "inline"
        },
        "fields": [
          {
            "name": "Значение",
            "key": "value",
            "type": "text"
          },
          {
            "name": "Название",
            "key": "label",
            "type": "text"
          },
          {
            "name": "Описание",
            "key": "desc",
            "type": "text"
          }
        ]
      },
      {
        "key": "suggest_sources",
        "name": "Источники словарей",
        "type": "object_array",
        "fields": [
          {
            "key": "suggest_id",
            "name": "Словарь",
            "type": "int"
          },
          {
            "key": "prefix",
            "name": "Префикс",
            "type": "text"
          },
          {
            "key": "label",
            "name": "Подпись",
            "type": "text"
          }
        ],
        "show_on": {
          "key": "source",
          "value": "suggest_union"
        }
      },
      {
        "key": "requires_proficiency",
        "name": "Требуется владение",
        "type": "bool"
      },
      {
        "key": "exclude_rank",
        "name": "Исключить достигнутый ранг",
        "type": "int"
      }
    ]
  },
  "derived_effects": {
    "name": "Производные эффекты",
    "key": "derived_effects",
    "type": "object_array",
    "fields": [
      {
        "name": "Вид",
        "key": "kind",
        "type": "select",
        "options": [
          {
            "label": "Формула КД",
            "value": "armor_formula"
          },
          {
            "label": "Бонус КД",
            "value": "armor_bonus"
          },
          {
            "label": "Бонус скорости",
            "value": "speed_bonus"
          },
          {
            "label": "Владение навыком",
            "value": "skill_proficiency"
          },
          {
            "label": "Владение спасброском",
            "value": "save_proficiency"
          },
          {
            "label": "Бонус проверки",
            "value": "check_bonus"
          },
          {
            "label": "Бонус навыка",
            "value": "skill_bonus"
          },
          {
            "label": "Бонус спасброска",
            "value": "save_bonus"
          },
          {
            "label": "Бонус атаки оружием",
            "value": "weapon_attack_bonus"
          },
          {
            "label": "Порог критического попадания",
            "value": "critical_threshold"
          },
          {
            "label": "Режим броска",
            "value": "roll_mode"
          },
          {
            "label": "Бонус урона оружием",
            "value": "weapon_damage_bonus"
          },
          {
            "label": "Запрет действия",
            "value": "activity_block"
          },
          {
            "value": "tool_proficiency",
            "label": "Владение инструментом"
          },
          {
            "value": "weapon_proficiency",
            "label": "Владение оружием"
          },
          {
            "value": "armor_proficiency",
            "label": "Владение доспехами"
          },
          {
            "value": "language_proficiency",
            "label": "Знание языка"
          }
        ]
      },
      {
        "name": "С уровня",
        "key": "level",
        "type": "int",
        "default": 1
      },
      {
        "name": "Значение",
        "key": "value",
        "type": "int"
      },
      {
        "name": "База",
        "key": "base",
        "type": "int"
      },
      {
        "name": "Характеристики",
        "key": "ability_ids",
        "type": "suggest_array",
        "suggest_id": 16
      },
      {
        "name": "Ранг владения",
        "key": "rank",
        "type": "int"
      },
      {
        "name": "Ключ выбора",
        "key": "choice_key",
        "type": "text"
      },
      {
        "name": "Значения выбора",
        "key": "choice_values",
        "type": "text_array"
      },
      {
        "name": "Цель берётся из выбора",
        "key": "target_from_choice",
        "type": "bool"
      },
      {
        "name": "Группа прогрессии",
        "key": "group",
        "type": "text"
      },
      {
        "name": "Множитель мастерства",
        "key": "proficiency_multiplier",
        "type": "float"
      },
      {
        "name": "Только без владения",
        "key": "only_without_proficiency",
        "type": "bool"
      },
      {
        "name": "Характеристика-модификатор",
        "key": "ability_modifier",
        "type": "suggest",
        "suggest_id": 16
      },
      {
        "name": "Нужен доспех",
        "key": "requires_armor",
        "type": "bool"
      },
      {
        "name": "Без доспеха",
        "key": "requires_no_armor",
        "type": "bool"
      },
      {
        "name": "Разрешён щит",
        "key": "allow_shield",
        "type": "bool",
        "default": true
      },
      {
        "name": "Не в тяжёлом доспехе",
        "key": "forbid_heavy_armor",
        "type": "bool"
      },
      {
        "name": "Вид оружия",
        "key": "weapon_kind",
        "type": "select",
        "options": [
          {
            "label": "Любое",
            "value": "any"
          },
          {
            "label": "Рукопашное",
            "value": "melee"
          },
          {
            "label": "Дальнобойное",
            "value": "ranged"
          }
        ]
      },
      {
        "name": "Области броска",
        "key": "scopes",
        "type": "text_array"
      },
      {
        "name": "Режим",
        "key": "mode",
        "type": "select",
        "options": [
          {
            "label": "Преимущество",
            "value": "advantage"
          },
          {
            "label": "Помеха",
            "value": "disadvantage"
          }
        ]
      },
      {
        "name": "Пояснение",
        "key": "label",
        "type": "text"
      },
      {
        "key": "value_parameter",
        "name": "Параметр значения",
        "type": "text"
      },
      {
        "key": "target_ids",
        "name": "Цели правила",
        "type": "text_array"
      },
      {
        "key": "skill_ids",
        "name": "Навыки",
        "type": "suggest_array",
        "suggest_id": 15
      },
      {
        "key": "choice_value_prefix",
        "name": "Часть общего выбора",
        "type": "text"
      },
      {
        "key": "minimum",
        "name": "Минимальная прибавка",
        "type": "int"
      }
    ]
  },
  "roll_triggers": {
    "name": "Триггеры броска",
    "key": "roll_triggers",
    "type": "object_array",
    "fields": [
      {
        "name": "Событие",
        "key": "event",
        "type": "select",
        "options": [
          {
            "label": "Натуральная 1",
            "value": "natural_one"
          }
        ],
        "default": "natural_one"
      },
      {
        "name": "Действие",
        "key": "action",
        "type": "select",
        "options": [
          {
            "label": "Предложить переброс",
            "value": "reroll"
          }
        ],
        "default": "reroll"
      },
      {
        "name": "Текст действия",
        "key": "label",
        "type": "text"
      },
      {
        "name": "С уровня",
        "key": "level",
        "type": "int",
        "default": 1
      },
      {
        "key": "scopes",
        "name": "Какие броски",
        "type": "text_array"
      }
    ]
  },
  "roll_adjustments": {
    "key": "roll_adjustments",
    "name": "Корректировки броска",
    "type": "object_array",
    "fields": [
      {
        "key": "kind",
        "name": "Вид",
        "type": "select",
        "options": [
          {
            "label": "Минимум на к20",
            "value": "minimum_natural"
          }
        ],
        "default": "minimum_natural"
      },
      {
        "key": "value",
        "name": "Минимум",
        "type": "int",
        "default": 10
      },
      {
        "key": "scope",
        "name": "Область броска",
        "type": "select",
        "options": [
          {
            "label": "Проверка характеристики",
            "value": "ability_check"
          },
          {
            "label": "Спасбросок",
            "value": "saving_throw"
          },
          {
            "label": "Атака",
            "value": "attack"
          },
          {
            "label": "Инициатива",
            "value": "initiative"
          }
        ]
      },
      {
        "key": "minimum_proficiency_rank",
        "name": "Минимальный ранг владения",
        "type": "int"
      },
      {
        "key": "label",
        "name": "Пояснение",
        "type": "text"
      },
      {
        "key": "level",
        "name": "С уровня",
        "type": "int",
        "default": 1
      }
    ]
  }
}$dependency_fields$::jsonb AS blocks)
UPDATE dndshare.item_type t SET fields = (
 SELECT jsonb_agg(COALESCE(patch.blocks->(field->>'key'),field) ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY rows(field,ord)
) FROM patch WHERE t.id IN (3,4,18);
