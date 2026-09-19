-- Declarative result tables and chained attacks. Catalogue entries are configured over MCP.
UPDATE dndshare.item_type SET fields = (
 SELECT jsonb_agg(CASE WHEN f->>'key'='damage' THEN
  jsonb_set(f,'{fields}',(f->'fields') || (
   SELECT COALESCE(jsonb_agg(n),'[]'::jsonb) FROM jsonb_array_elements(
'[
  {
    "key": "roll_table",
    "name": "Тип урона по броску",
    "type": "object",
    "optional": true,
    "hint": "Тип определяется после броска. Кости, определяющие тип, задаются отдельно от дополнительных костей критического урона.",
    "fields": [
      {
        "key": "source",
        "name": "Откуда взять результат",
        "type": "select",
        "options": [
          {
            "value": "damage",
            "label": "Из костей урона"
          },
          {
            "value": "separate",
            "label": "Отдельный бросок по таблице"
          }
        ]
      },
      {
        "key": "sides",
        "name": "Граней у кости",
        "type": "int",
        "min": 2,
        "max": 100
      },
      {
        "key": "count",
        "name": "Костей для определения типа",
        "type": "int",
        "min": 1,
        "max": 10
      },
      {
        "key": "rows",
        "name": "Результаты",
        "type": "object_array",
        "rowName": "Результат",
        "fields": [
          {
            "key": "value",
            "name": "Выпало",
            "type": "int",
            "min": 1,
            "max": 100
          },
          {
            "key": "damage_type",
            "name": "Тип урона",
            "type": "suggest",
            "suggest_id": 12
          }
        ]
      }
    ]
  },
  {
    "key": "attack_chain",
    "name": "Продолжение атаки",
    "type": "object",
    "optional": true,
    "fields": [
      {
        "key": "trigger",
        "name": "Когда можно продолжить",
        "type": "select",
        "options": [
          {
            "value": "matching_damage",
            "label": "Совпали кости определения типа"
          },
          {
            "value": "odd_attack",
            "label": "Нечётный результат основного к20 при попадании"
          },
          {
            "value": "always",
            "label": "После каждого попадания"
          }
        ]
      },
      {
        "key": "distance",
        "name": "Дистанция следующей цели, фт.",
        "type": "int",
        "min": 1,
        "hint": "Расстояние проверяет мастер: сайт не хранит координаты."
      },
      {
        "key": "origin",
        "name": "Откуда считать дистанцию",
        "type": "select",
        "options": [
          {
            "value": "previous",
            "label": "От предыдущей цели"
          },
          {
            "value": "caster",
            "label": "От заклинателя"
          }
        ]
      },
      {
        "key": "unique",
        "name": "Не выбирать повторно",
        "type": "select",
        "options": [
          {
            "value": "target",
            "label": "Все ранее выбранные цели"
          },
          {
            "value": "hit",
            "label": "Только уже поражённые цели"
          }
        ]
      }
    ]
  }
]'::jsonb) n WHERE NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(f->'fields') old WHERE old->>'key'=n->>'key'
   )
  )) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(fields) WITH ORDINALITY a(f,ord)
) WHERE id=5;
