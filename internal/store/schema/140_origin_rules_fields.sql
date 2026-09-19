-- Edition-specific rule data lives on the concrete catalogue version.
UPDATE dndshare.item_type SET fields=COALESCE(fields,'[]') || '[
 {"name":"Характеристики предыстории (2024)","key":"ability_options","type":"suggest_array","suggest_id":16},
 {"name":"Черта происхождения (2024)","key":"origin_feat_id","type":"item","item_type":7}
]'::jsonb WHERE id=11;
UPDATE dndshare.item_type SET fields=COALESCE(fields,'[]') || '[
 {"name":"Категория черты","key":"category","type":"select","options":[{"value":"origin","label":"Происхождение"},{"value":"general","label":"Общая"},{"value":"fighting_style","label":"Боевой стиль"},{"value":"epic_boon","label":"Эпический дар"}]}
]'::jsonb WHERE id=7;
UPDATE dndshare.item_type SET fields=COALESCE(fields,'[]') || '[
 {"name":"Мастерство оружия (2024)","key":"mastery","type":"text"}
]'::jsonb WHERE id=1;

UPDATE dndshare.item_type SET fields=COALESCE(fields,'[]') || '[{"name":"Золото вместо стартового комплекта (2024)","key":"starting_gold","type":"int"}]'::jsonb WHERE id IN (9,11);

UPDATE dndshare.item_type SET fields=fields || '[{"key": "origin_feat_class_id", "name": "Список заклинаний черты происхождения", "type": "item", "item_type": 9}]'::jsonb WHERE id=11;
UPDATE dndshare.item_type SET fields=fields || '[
  {
    "key": "starting_kit",
    "name": "Стартовый комплект (2024)",
    "type": "object",
    "fields": [
      {
        "key": "gold",
        "name": "Золото",
        "type": "int",
        "min": 0
      },
      {
        "key": "fixed",
        "name": "Фиксированные предметы",
        "type": "object_array",
        "fields": [
          {
            "key": "name",
            "name": "Название",
            "type": "text"
          },
          {
            "key": "item_id",
            "name": "Предмет",
            "type": "item",
            "item_type": 2
          },
          {
            "key": "count",
            "name": "Количество",
            "type": "int",
            "min": 1
          }
        ]
      },
      {
        "key": "groups",
        "name": "Варианты комплекта",
        "type": "object_array",
        "fields": [
          {
            "key": "id",
            "name": "Ключ",
            "type": "text"
          },
          {
            "key": "label",
            "name": "Название",
            "type": "text"
          },
          {
            "key": "options",
            "name": "Варианты",
            "type": "object_array",
            "fields": [
              {
                "key": "id",
                "name": "Ключ",
                "type": "text"
              },
              {
                "key": "label",
                "name": "Название",
                "type": "text"
              },
              {
                "key": "gold",
                "name": "Золото",
                "type": "int",
                "min": 0
              },
              {
                "key": "items",
                "name": "Предметы",
                "type": "object_array",
                "fields": [
                  {
                    "key": "name",
                    "name": "Название",
                    "type": "text"
                  },
                  {
                    "key": "item_id",
                    "name": "Предмет",
                    "type": "item",
                    "item_type": 2
                  },
                  {
                    "key": "count",
                    "name": "Количество",
                    "type": "int",
                    "min": 1
                  }
                ]
              },
              {
                "key": "picks",
                "name": "Выбор в варианте",
                "type": "object_array",
                "fields": [
                  {
                    "key": "id",
                    "name": "Ключ",
                    "type": "text"
                  },
                  {
                    "key": "label",
                    "name": "Название",
                    "type": "text"
                  },
                  {
                    "key": "count",
                    "name": "Количество",
                    "type": "int",
                    "min": 1
                  },
                  {
                    "key": "options",
                    "name": "Названия предметов",
                    "type": "text_array"
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "key": "fixedPicks",
        "name": "Выбор в фиксированном комплекте",
        "type": "object_array",
        "fields": [
          {
            "key": "id",
            "name": "Ключ",
            "type": "text"
          },
          {
            "key": "label",
            "name": "Название",
            "type": "text"
          },
          {
            "key": "count",
            "name": "Количество",
            "type": "int",
            "min": 1
          },
          {
            "key": "options",
            "name": "Названия предметов",
            "type": "text_array"
          }
        ]
      }
    ]
  }
]'::jsonb WHERE id=9;
UPDATE dndshare.item_type SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='spellcasting' THEN jsonb_set(f,'{fields}',(f->'fields') || '[{"key":"prepared_progression","name":"Количество подготовленных заклинаний по уровню","type":"object_array","fields":[{"key":"level","name":"Уровень класса","type":"int","min":1,"max":20},{"key":"count","name":"Количество","type":"int","min":0}]}]'::jsonb) ELSE f END ORDER BY n) FROM jsonb_array_elements(fields) WITH ORDINALITY a(f,n)) WHERE id IN (9,17);

UPDATE dndshare.item_type SET fields=(
  SELECT jsonb_agg(CASE
    WHEN f->>'key'='selection_requirements' THEN jsonb_set(f,'{fields}',(f->'fields') || '[
      {"key":"abilities","name":"Необходимые способности","type":"object_array","fields":[
        {"key":"id","name":"Способность","type":"item","item_type":4},
        {"key":"name","name":"Подпись требования","type":"text"}
      ]}
    ]'::jsonb)
    WHEN f->>'key'='ability_selection' THEN jsonb_set(f,'{fields}',(f->'fields') || '[
      {"key":"replace_levels","name":"Уровни замены (пусто — каждый уровень)","type":"text_array"}
    ]'::jsonb)
    ELSE f END ORDER BY n)
  FROM jsonb_array_elements(fields) WITH ORDINALITY a(f,n)
) WHERE id=4;
UPDATE dndshare.item_type SET fields=(
  SELECT jsonb_agg(CASE WHEN f->>'key'='variants' THEN jsonb_set(f,'{fields}',(f->'fields') || '[
    {"key":"size","name":"Размер","type":"text"},
    {"key":"speed","name":"Скорость, фт","type":"int","min":0}
  ]'::jsonb) ELSE f END ORDER BY n)
  FROM jsonb_array_elements(fields) WITH ORDINALITY a(f,n)
) WHERE id IN (8,16);
