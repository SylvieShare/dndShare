-- Creation recipes and explicit source links use the existing cast transaction.
UPDATE dndshare.item_type SET fields=fields || jsonb_build_array('{
  "key": "item_creation",
  "name": "Создание предметов",
  "type": "object_array",
  "fields": [
    {
      "key": "key",
      "name": "Ключ варианта",
      "type": "text",
      "required": true
    },
    {
      "key": "title",
      "name": "Название варианта",
      "type": "text",
      "required": true
    },
    {
      "key": "choose_count",
      "name": "Можно создать меньше",
      "type": "bool",
      "hint": "При одном виде предметов игрок выбирает количество, не больше рассчитанного."
    },
    {
      "key": "condition",
      "name": "Условие создания",
      "type": "text"
    },
    {
      "key": "outputs",
      "name": "Что создаётся",
      "type": "object_array",
      "required": true,
      "fields": [
        {
          "key": "item",
          "name": "Предмет из справочника",
          "type": "item",
          "required": true
        },
        {
          "key": "count",
          "name": "Количество",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 999
        },
        {
          "key": "per_slot",
          "name": "Дополнительно за круг выше",
          "type": "int",
          "min": 0,
          "max": 999
        },
        {
          "key": "scaling_step",
          "name": "За каждые круги",
          "type": "int",
          "default": 1,
          "min": 1,
          "max": 9
        },
        {
          "key": "duration",
          "name": "Срок действия предмета",
          "type": "object",
          "optional": true,
          "fields": [
            {
              "key": "kind",
              "name": "Когда заканчивается",
              "type": "select",
              "default": "manual",
              "options": [
                {
                  "value": "manual",
                  "label": "Отмечается вручную"
                },
                {
                  "value": "rounds",
                  "label": "Раунды"
                },
                {
                  "value": "minutes",
                  "label": "Минуты"
                },
                {
                  "value": "hours",
                  "label": "Часы"
                },
                {
                  "value": "days",
                  "label": "Дни"
                },
                {
                  "value": "custom",
                  "label": "Условие текстом"
                },
                {
                  "value": "permanent",
                  "label": "Постоянно"
                }
              ]
            },
            {
              "key": "value",
              "name": "Количество",
              "type": "int",
              "min": 1,
              "max": 10000
            },
            {
              "key": "text",
              "name": "Условие окончания",
              "type": "text"
            }
          ]
        }
      ]
    }
  ]
}'::jsonb) WHERE id IN (5);
UPDATE dndshare.item_type SET fields=fields || jsonb_build_array('{
  "key": "creation_sources",
  "name": "Создаётся магией",
  "type": "object_array",
  "fields": [
    {
      "key": "item",
      "name": "Заклинание-источник",
      "type": "item",
      "item_type": 5,
      "required": true
    }
  ]
}'::jsonb) WHERE id IN (1,2,10,12,13,14,19);
