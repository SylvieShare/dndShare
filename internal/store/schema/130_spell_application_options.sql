-- Explicit application boundaries for effects and formula-only healing.
UPDATE dndshare.item_type SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='damage' THEN jsonb_set(f,'{fields}',COALESCE(f->'fields','[]'::jsonb)||
 '[{"key":"save_condition","name":"Когда требуется спасбросок","type":"text"},{"key":"save_manual","name":"Объявлять спасбросок отдельно","type":"bool","hint":"Для повторных или условных этапов: не объявлять при каждом броске основного урона или применении эффекта."}]'::jsonb)
 WHEN f->>'key'='heal' THEN jsonb_set(f,'{fields}',COALESCE(f->'fields','[]'::jsonb)||
 '[{"key":"apply","name":"Применять лечение к цели","type":"bool","default":true,"hint":"Выключите для создания эликсира, повторяющегося лечения и формул, которые нельзя применить сразу при сотворении."}]'::jsonb)
 WHEN f->>'key'='application_targets' THEN jsonb_set(f,'{fields}',(f->'fields')||
 '[{"key":"self_only","name":"Только на себя","type":"bool","hint":"Для личных усилений. Не включайте для ауры, которая действует также на союзников."}]'::jsonb)
 ELSE f END ORDER BY ord) FROM jsonb_array_elements(fields) WITH ORDINALITY rows(f,ord)) WHERE id=5;

-- Effects use the same numeric, armor and skill contracts as feature rules.
WITH additions AS (SELECT '[
 {"key":"skill_ids","name":"Навыки","type":"suggest_array","suggest_id":15},
 {"key":"base","name":"Базовый КД","type":"int"},
 {"key":"allow_shield","name":"Допускает щит","type":"bool","default":true}
]'::jsonb AS fields)
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='derived_effects' THEN jsonb_set(f,'{fields}',
 (SELECT jsonb_agg(CASE WHEN c->>'key'='kind' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'options') o WHERE o->>'value'='armor_formula')
 THEN jsonb_set(c,'{options}',(c->'options')||'[{"value":"armor_formula","label":"Формула КД"}]'::jsonb) ELSE c END ORDER BY n)
 FROM jsonb_array_elements(f->'fields') WITH ORDINALITY a(c,n)) ||
 COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(additions.fields) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'fields') c WHERE c->>'key'=x->>'key')),'[]'::jsonb))
 ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY rows(f,ord)) FROM additions WHERE t.id=15;
WITH additions AS (SELECT '[
 {"key":"rank","name":"Уровень владения","type":"int","default":1,"hint":"1 — владение, 2 — компетентность."},
 {"key":"weapon_attacks_only","name":"Только атаки оружием","type":"bool"},
 {"key":"forbid_improvised","name":"Кроме импровизированного оружия","type":"bool"}
]'::jsonb AS fields)
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='derived_effects' THEN jsonb_set(f,'{fields}',
 (SELECT jsonb_agg(CASE WHEN c->>'key'='kind' THEN jsonb_set(c,'{options}',(c->'options')||
 COALESCE((SELECT jsonb_agg(o) FROM jsonb_array_elements('[{"value":"skill_proficiency","label":"Владение навыком"},{"value":"save_proficiency","label":"Владение спасброском"}]'::jsonb) o WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(c->'options') old WHERE old->>'value'=o->>'value')),'[]'::jsonb)) ELSE c END ORDER BY n)
 FROM jsonb_array_elements(f->'fields') WITH ORDINALITY a(c,n)) ||
 COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(additions.fields) x WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'fields') c WHERE c->>'key'=x->>'key')),'[]'::jsonb))
 ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY rows(f,ord)) FROM additions WHERE t.id=15;

-- Formula parameters and duration depend on the caster's selected spell slot.
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='status_effects' THEN jsonb_set(f,'{fields}',
 (SELECT jsonb_agg(CASE WHEN c->>'key'='parameter_bindings' THEN jsonb_set(c,'{fields}',
 (SELECT jsonb_agg(CASE WHEN b->>'key'='source' THEN jsonb_set(b,'{options}',(b->'options')||'[{"value":"slot_increase","label":"Кругов выше базового"},{"value":"cast_level","label":"Круг ячейки"},{"value":"casting_modifier","label":"Модификатор заклинателя"}]'::jsonb) ELSE b END ORDER BY bn) FROM jsonb_array_elements(c->'fields') WITH ORDINALITY q(b,bn)) ||
 '[{"key":"step","name":"Шаг изменения","type":"int","default":1},{"key":"multiplier","name":"За каждый шаг","type":"int","default":1},{"key":"minimum","name":"Не меньше","type":"int"},{"key":"maximum","name":"Не больше","type":"int"}]'::jsonb) ELSE c END ORDER BY cn) FROM jsonb_array_elements(f->'fields') WITH ORDINALITY q(c,cn)) ||
 '[{"key":"duration_levels","name":"Длительность по кругу ячейки","type":"object_array","fields":[{"key":"level","name":"Начиная с круга","type":"int"},{"key":"duration","name":"Длительность","type":"object","fields":[{"key":"kind","name":"Единицы","type":"select","options":[{"value":"rounds","label":"Раунды"},{"value":"minutes","label":"Минуты"},{"value":"hours","label":"Часы"}]},{"key":"value","name":"Количество","type":"int"}]}]}]'::jsonb)
 ELSE f END ORDER BY ord) FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,ord)) WHERE id=5;
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(CASE WHEN f->>'key'='weapon_damage' THEN jsonb_set(f,'{fields}',(f->'fields')||'[{"key":"dice_count_parameter","name":"Число костей из параметра эффекта","type":"text"}]'::jsonb) ELSE f END ORDER BY ord) FROM jsonb_array_elements(t.fields) WITH ORDINALITY q(f,ord)) WHERE id=15;
