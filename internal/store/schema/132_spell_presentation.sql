-- Canonical structured casting time and range. Old strings are converted once.
UPDATE dndshare.item_type SET fields=(SELECT jsonb_agg(CASE f->>'key'
 WHEN 'time' THEN $time${"key":"time","name":"Время сотворения","type":"object","fields":[{"key":"kind","name":"Вид времени","type":"select","options":[{"value":"action","label":"Действие"},{"value":"bonus_action","label":"Бонусное действие"},{"value":"reaction","label":"Реакция"},{"value":"free","label":"Свободное действие"},{"value":"special","label":"Особое действие"},{"value":"rounds","label":"Раунды"},{"value":"minutes","label":"Минуты"},{"value":"hours","label":"Часы"},{"value":"days","label":"Дни"},{"value":"custom","label":"Своё значение"}]},{"key":"value","name":"Количество","type":"int","min":1},{"key":"condition","name":"Условие реакции","type":"text"},{"key":"text","name":"Своё время","type":"text"}]}$time$::jsonb
 WHEN 'range' THEN $range${"key":"range","name":"Дистанция и область","type":"object","fields":[{"key":"kind","name":"Дистанция","type":"select","options":[{"value":"touch","label":"Ближнее: касание"},{"value":"ranged","label":"Дальнее"},{"value":"self","label":"От себя / на себя"},{"value":"sight","label":"В пределах видимости"},{"value":"unlimited","label":"Без ограничений"},{"value":"custom","label":"Своё значение"}]},{"key":"distance","name":"Дальность","type":"int","min":1},{"key":"unit","name":"Единица дальности","type":"select","default":"feet","options":[{"value":"feet","label":"Футы"},{"value":"miles","label":"Мили"}]},{"key":"can_self","name":"Можно выбирать себя","type":"bool","hint":"Отметьте, если заклинание допускает заклинателя как цель. Не отменяет ограничения в описании. Отдельно от исходящей от себя области; это справочная метка, а не автоматическая проверка целей."},{"key":"shape","name":"Форма области","type":"select","emptyLabel":"Нет области","options":[{"value":"sphere","label":"Сфера"},{"value":"radius","label":"Радиус"},{"value":"cone","label":"Конус"},{"value":"line","label":"Линия"},{"value":"cube","label":"Куб"},{"value":"cylinder","label":"Цилиндр"},{"value":"hemisphere","label":"Полусфера"}]},{"key":"size","name":"Размер области","type":"int","min":1,"hint":"Радиус сферы/цилиндра, длина конуса/линии или ребро куба. Ширину линии и высоту цилиндра укажите в описании."},{"key":"area_unit","name":"Единица области","type":"select","default":"feet","options":[{"value":"feet","label":"Футы"},{"value":"miles","label":"Мили"}]},{"key":"text","name":"Своя дистанция","type":"text"}]}$range$::jsonb
 ELSE f END ORDER BY n) FROM jsonb_array_elements(fields) WITH ORDINALITY x(f,n)) WHERE id=5;

UPDATE dndshare.item_type SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='feature_actions'
 THEN jsonb_set(f,'{fields}',(SELECT jsonb_agg(CASE WHEN a->>'key'='action_type'
 THEN jsonb_set(a,'{options}',(a->'options')||'[{"value":"timed","label":"Требует времени"}]'::jsonb) ELSE a END ORDER BY j)
 FROM jsonb_array_elements(f->'fields') WITH ORDINALITY r(a,j)) || $time${"key":"time","name":"Время выполнения","type":"object","fields":[{"key":"kind","name":"Вид времени","type":"select","options":[{"value":"action","label":"Действие"},{"value":"bonus_action","label":"Бонусное действие"},{"value":"reaction","label":"Реакция"},{"value":"free","label":"Свободное действие"},{"value":"special","label":"Особое действие"},{"value":"rounds","label":"Раунды"},{"value":"minutes","label":"Минуты"},{"value":"hours","label":"Часы"},{"value":"days","label":"Дни"},{"value":"custom","label":"Своё значение"}]},{"key":"value","name":"Количество","type":"int","min":1},{"key":"condition","name":"Условие реакции","type":"text"},{"key":"text","name":"Своё время","type":"text"}]}$time$::jsonb)
 ELSE f END ORDER BY n) FROM jsonb_array_elements(fields) WITH ORDINALITY x(f,n))
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(fields) f WHERE f->>'key'='feature_actions');

CREATE FUNCTION pg_temp.spell_time(raw text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE value text := btrim(raw); kind text;
BEGIN
 IF value IS NULL OR value='' THEN RETURN NULL; END IF;
 IF value='1 действие' THEN RETURN '{"kind":"action"}'::jsonb; END IF;
 IF value='1 бонусное действие' THEN RETURN '{"kind":"bonus_action"}'::jsonb; END IF;
 IF value ~ '^1 реакция(,|$)' THEN
  RETURN jsonb_strip_nulls(jsonb_build_object('kind','reaction','condition',NULLIF(btrim(regexp_replace(value,'^1 реакция,?\s*','')),'')));
 END IF;
 IF value ~ '^[0-9]+ (минут[аыу]?|час[аов]*|раунд[аов]*|день|дня|дней)$' THEN
  kind := CASE WHEN value ~ 'минут' THEN 'minutes' WHEN value ~ 'час' THEN 'hours' WHEN value ~ 'раунд' THEN 'rounds' ELSE 'days' END;
  RETURN jsonb_build_object('kind',kind,'value',substring(value FROM '^[0-9]+')::int);
 END IF;
 RETURN jsonb_build_object('kind','custom','text',raw);
END $$;

CREATE FUNCTION pg_temp.spell_range(raw text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE value text := btrim(raw); main text; area text; result jsonb; shape text; quantity int; unit text;
BEGIN
 IF value IS NULL OR value='' THEN RETURN NULL; END IF;
 IF value='Касание' THEN RETURN '{"kind":"touch"}'::jsonb; END IF;
 IF value='На себя' THEN RETURN '{"kind":"self","can_self":true}'::jsonb; END IF;
 IF value IN ('Видимость','Область видимости') THEN RETURN '{"kind":"sight"}'::jsonb; END IF;
 IF value IN ('Без ограничений','Неограниченная') THEN RETURN '{"kind":"unlimited"}'::jsonb; END IF;
 main := btrim(split_part(value,'(',1));
 IF main='На себя' THEN result := '{"kind":"self"}'::jsonb;
 ELSIF main ~ '^[0-9]+ (фут[аов]*|фт\.?|мил[яьи])$' THEN
  result := jsonb_build_object('kind','ranged','distance',substring(main FROM '^[0-9]+')::int,'unit',CASE WHEN main ~ 'мил' THEN 'miles' ELSE 'feet' END);
 ELSE RETURN jsonb_build_object('kind','custom','text',raw); END IF;
 area := substring(value FROM '\((.*)\)');
 IF area IS NULL THEN RETURN result; END IF;
 -- Alternatives and multi-dimensional areas retain their complete authored text.
 IF area ~ ' или ' OR (SELECT count(*) FROM regexp_matches(area,'[0-9]+','g')) <> 1 THEN RETURN jsonb_build_object('kind','custom','text',raw); END IF;
 shape := CASE WHEN area ~ 'полусфер' THEN 'hemisphere' WHEN area ~ 'сфер' THEN 'sphere' WHEN area ~ 'конус' THEN 'cone' WHEN area ~ 'лини' THEN 'line' WHEN area ~ 'куб' THEN 'cube' WHEN area ~ 'цилиндр' THEN 'cylinder' WHEN area ~ 'радиус' THEN 'radius' END;
 IF shape IS NULL THEN RETURN jsonb_build_object('kind','custom','text',raw); END IF;
 quantity := substring(area FROM '[0-9]+')::int;
 unit := CASE WHEN area ~ 'мил' THEN 'miles' ELSE 'feet' END;
 RETURN result || jsonb_build_object('shape',shape,'size',quantity,'area_unit',unit);
END $$;

UPDATE dndshare.item SET data=jsonb_set(data,'{time}',COALESCE(pg_temp.spell_time(data->>'time'),'null'::jsonb))
 WHERE type_id=5 AND jsonb_typeof(data->'time')='string';
UPDATE dndshare.item SET data=jsonb_set(data,'{range}',COALESCE(pg_temp.spell_range(data->>'range'),'null'::jsonb))
 WHERE type_id=5 AND jsonb_typeof(data->'range')='string';
UPDATE dndshare.item SET data=jsonb_set(data,'{range,can_self}','true'::jsonb)
 WHERE type_id=5 AND jsonb_typeof(data->'range')='object' AND data #>> '{application_targets,self_only}'='true';
