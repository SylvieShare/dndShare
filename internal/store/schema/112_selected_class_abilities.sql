-- Schema only. Invocation catalogue entries are authored through MCP.
WITH additions AS (
  SELECT value AS field FROM jsonb_array_elements($fields$[
    {"key":"ability_selection","name":"Способности на выбор по уровням","type":"object","fields":[
      {"key":"counts","name":"Число выбранных способностей","type":"object_array","fields":[
        {"key":"level","name":"С уровня класса","type":"int"},
        {"key":"count","name":"Всего способностей","type":"int"}
      ]},
      {"key":"replace_count","name":"Замен при повышении уровня","type":"int","default":1}
    ]},
    {"key":"selection_parent_id","name":"Получается только по выбору из способности","type":"item","item_type":4},
    {"key":"selection_requirements","name":"Требования выбора способности","type":"object","fields":[
      {"key":"spells","name":"Известные заклинания","type":"object_array","fields":[
        {"key":"id","name":"Заклинание","type":"item","item_type":5},
        {"key":"name","name":"Подпись требования","type":"text"}
      ]},
      {"key":"choices","name":"Выборы других способностей","type":"object_array","fields":[
        {"key":"item_id","name":"Способность","type":"item","item_type":4},
        {"key":"key","name":"Ключ выбора","type":"text"},
        {"key":"values","name":"Допустимые значения","type":"text_array"},
        {"key":"label","name":"Подпись требования","type":"text"}
      ]}
    ]}
  ]$fields$::jsonb)
)
UPDATE dndshare.item_type t SET fields = COALESCE(t.fields, '[]'::jsonb) || (
  SELECT COALESCE(jsonb_agg(field), '[]'::jsonb) FROM additions
  WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) existing WHERE existing->>'key' = field->>'key')
) WHERE t.id = 4;

WITH new_field AS (SELECT $field${"key":"spell_modifiers","name":"Изменения заклинаний","type":"object_array","fields":[
  {"key":"spell_id","name":"Заклинание","type":"item","item_type":5},
  {"key":"damage_ability","name":"Модификатор к урону попадания","type":"suggest","suggest_id":16},
  {"key":"range","name":"Дистанция","type":"text"}
]}$field$::jsonb AS field)
UPDATE dndshare.item_type t SET fields = t.fields || jsonb_build_array(new_field.field)
FROM new_field WHERE t.id IN (3,4,7)
AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key' = 'spell_modifiers');
