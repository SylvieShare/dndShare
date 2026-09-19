UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='damage' THEN jsonb_set(f,'{fields}',(SELECT jsonb_agg(
  CASE WHEN c->>'key'='attack_chain' THEN $chain${
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
        },
        {
          "value": "matching_dice",
          "label": "Совпало несколько костей урона"
        },
        {
          "value": "none",
          "label": "Без перескоков — отдельные снаряды"
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
        },
        {
          "value": "none",
          "label": "Можно направить несколько снарядов в одну цель"
        }
      ]
    },
    {
      "key": "sides",
      "name": "Граней у проверяемой кости",
      "type": "int",
      "min": 2,
      "max": 100,
      "show_on": {
        "key": "trigger",
        "value": "matching_dice"
      }
    },
    {
      "key": "matches",
      "name": "Сколько одинаковых результатов нужно",
      "type": "int",
      "min": 2,
      "max": 100,
      "default": 2,
      "show_on": {
        "key": "trigger",
        "value": "matching_dice"
      },
      "hint": "Проверяются все кости выбранного размера, включая дополнительные кости критического попадания."
    },
    {
      "key": "max_jumps",
      "name": "Перескоков за сотворение",
      "type": "int",
      "min": 1,
      "max": 99,
      "optional": true,
      "hint": "Пусто — без ограничения числа перескоков. Каждая следующая атака считается, даже при промахе."
    },
    {
      "key": "jumps_per_slot",
      "name": "Дополнительных перескоков за круг выше",
      "type": "int",
      "min": 0,
      "max": 99,
      "optional": true,
      "hint": "Прибавляется к заданному лимиту за каждый круг выше уровня заклинания."
    }
  ]
}$chain$::jsonb ELSE c END ORDER BY cn)
 FROM jsonb_array_elements(f->'fields') WITH ORDINALITY q(c,cn))) ELSE f END ORDER BY n)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,n)) WHERE t.id=5;
