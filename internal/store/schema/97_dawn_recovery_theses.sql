-- Explicit dawn rules; text notes are never parsed at runtime.
WITH spec AS (SELECT $dawn_field${"key": "dawn_recovery", "name": "Восстановление на рассвете", "type": "object", "fields": [{"key": "mode", "name": "Способ восстановления", "type": "select", "options": [{"value": "full", "label": "Полностью"}, {"value": "roll", "label": "По формуле"}]}, {"key": "formula", "name": "Сколько восстановить", "type": "text", "hint": "Например, 1к3 или 1к6+1. Итог не превышает максимум ресурса."}]}$dawn_field$::jsonb AS field)
UPDATE dndshare.item_type t SET fields=(SELECT jsonb_agg(
 CASE WHEN f->>'key'='use_resources' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f->'fields') c WHERE c->>'key'='dawn_recovery')
 THEN jsonb_set(f,'{fields}',(f->'fields')||jsonb_build_array(spec.field)) ELSE f END ORDER BY ord)
 FROM jsonb_array_elements(t.fields) WITH ORDINALITY rows(f,ord))
 || CASE WHEN EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='dawn_recovery') THEN '[]'::jsonb ELSE jsonb_build_array(spec.field) END
 FROM spec WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(t.fields) f WHERE f->>'key'='max_use');

UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "roll", "formula": "1d3"}}$rule$::jsonb WHERE id=86 AND name='Посох иссушения' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');
UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "roll", "formula": "1d6+1"}, "recharge_note": "При расходе последнего заряда бросьте к20: на 1 палочка уничтожается."}$rule$::jsonb WHERE id=95 AND name='Волшебная палочка огненных шаров' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');
UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "full"}}$rule$::jsonb WHERE id=114 AND name='Доспех из драконьей чешуи' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');
UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "full"}}$rule$::jsonb WHERE id=149 AND name='Кинжал яда' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');
UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "roll", "formula": "1d3"}}$rule$::jsonb WHERE id=178 AND name='Трезубец управления рыбами' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');
UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "roll", "formula": "1d3"}}$rule$::jsonb WHERE id=273 AND name='Булава ужаса' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');
UPDATE dndshare.item SET data=(data-'recharge_note') || $rule${"dawn_recovery": {"mode": "full"}}$rule$::jsonb WHERE id=289 AND name='Латы эфирности' AND type_id=19 AND user_id IS NULL AND NOT (data ? 'dawn_recovery');

-- Only rewrite the exact seeded prose: preserve user-authored edits and rich links.
WITH changes AS (SELECT * FROM jsonb_to_recordset($theses$[
  {
    "id": 85,
    "key": "dance",
    "before": "<p>Бонусным действием меч летит до 30 футов и атакует выбранное существо в пределах 5 футов от него, используя ваш бросок атаки и модификатор урона. После четвёртой атаки он возвращается. Дистанцию, число атак и свободную руку отслеживайте по описанию.</p>",
    "after": "<ul><li>Бонусным действием меч летит до 30 футов и атакует выбранное существо в пределах 5 футов от него, используя ваш бросок атаки и модификатор урона.</li><li>После четвёртой атаки он возвращается.</li><li>Дистанцию, число атак и свободную руку отслеживайте по описанию.</li></ul>"
  },
  {
    "id": 114,
    "key": "detect_dragon",
    "before": "<p>Определите направление и расстояние до ближайшего дракона выбранного вида в пределах 30 миль. Поиск расходует использование доспеха.</p>",
    "after": "<ul><li>Определите направление и расстояние до ближайшего дракона выбранного вида в пределах 30 миль.</li><li>Поиск расходует использование доспеха.</li></ul>"
  },
  {
    "id": 136,
    "key": "ignite",
    "before": "<p>Произнесите командное слово. Горящий меч освещает 40 футов ярко и ещё 40 тускло. Для урона включите «Горящий клинок» в меню меча; выключите после тушения, убирания или падения меча.</p>",
    "after": "<ul><li>Произнесите командное слово.</li><li>Горящий меч освещает 40 футов ярко и ещё 40 тускло.</li><li>Для урона включите «Горящий клинок» в меню меча; выключите после тушения, убирания или падения меча.</li></ul>"
  },
  {
    "id": 149,
    "key": "apply_poison",
    "before": "<p>Яд действует 1 минуту или до следующего попадания. При попадании цель совершает спасбросок Телосложения Сл 15: при провале получает 2к10 урона ядом и отравлена 1 минуту. Бросок урона ядом выполняется отдельно, без удвоения при крите.</p>",
    "after": "<ul><li>Яд действует 1 минуту или до следующего попадания.</li><li>При попадании цель совершает спасбросок Телосложения Сл 15: при провале получает 2к10 урона ядом и отравлена 1 минуту.</li><li>Бросок урона ядом выполняется отдельно, без удвоения при крите.</li></ul>"
  },
  {
    "id": 263,
    "key": "blade",
    "before": "<p>Бонусным действием проявите или скройте клинок. Пока он проявлен, действуют оружейные свойства и солнечный свет: 15 футов яркого и ещё 15 футов тусклого.</p>",
    "after": "<ul><li>Бонусным действием проявите или скройте клинок.</li><li>Пока он проявлен, действуют оружейные свойства и солнечный свет: 15 футов яркого и ещё 15 футов тусклого.</li></ul>"
  },
  {
    "id": 263,
    "key": "sunlight",
    "before": "<p>Увеличьте или уменьшите радиусы яркого и тусклого солнечного света на 5 футов каждый. Пределы каждого радиуса — от 10 до 30 футов. Требуется проявленный клинок.</p>",
    "after": "<ul><li>Увеличьте или уменьшите радиусы яркого и тусклого солнечного света на 5 футов каждый.</li><li>Пределы каждого радиуса — от 10 до 30 футов.</li><li>Требуется проявленный клинок.</li></ul>"
  },
  {
    "id": 273,
    "key": "terror",
    "before": "<p>Выбранные существа в пределах 30 футов совершают спасбросок Мудрости Сл 15 или испуганы на 1 минуту. Они удаляются от вас, не реагируют; ограничения действий и повторный спасбросок в конце каждого хода — по описанию булавы.</p>",
    "after": "<ul><li>Выбранные существа в пределах 30 футов совершают спасбросок Мудрости Сл 15 или испуганы на 1 минуту.</li><li>Они удаляются от вас, не реагируют; ограничения действий и повторный спасбросок в конце каждого хода — по описанию булавы.</li></ul>"
  },
  {
    "id": 289,
    "key": "etherealness",
    "before": "<p>Произнесите командное слово и получите эффект «Эфирность» на 10 минут. Эффект заканчивается при снятии лат или повторном произнесении слова действием.</p>",
    "after": "<ul><li>Произнесите командное слово и получите эффект «Эфирность» на 10 минут.</li><li>Эффект заканчивается при снятии лат или повторном произнесении слова действием.</li></ul>"
  },
  {
    "id": 289,
    "key": "end_etherealness",
    "before": "<p>Повторите командное слово, чтобы досрочно прекратить эфирность. Не расходует новое использование.</p>",
    "after": "<ul><li>Повторите командное слово, чтобы досрочно прекратить эфирность.</li><li>Не расходует новое использование.</li></ul>"
  },
  {
    "id": 325,
    "key": "swift_attack",
    "before": "<p>Совершите одну атаку этим скимитаром бонусным действием в свой ход. Используйте обычное меню броска этого экземпляра.</p>",
    "after": "<ul><li>Совершите одну атаку этим скимитаром бонусным действием в свой ход.</li><li>Используйте обычное меню броска этого экземпляра.</li></ul>"
  },
  {
    "id": 332,
    "key": "animate",
    "before": "<p>Произнесите командное слово. Щит парит в вашем пространстве 1 минуту и даёт обычную защиту, освобождая руки. Эффект можно прекратить бонусным действием; недееспособность или смерть также прекращают его. Длительность отмечается вручную.</p>",
    "after": "<ul><li>Произнесите командное слово.</li><li>Щит парит в вашем пространстве 1 минуту и даёт обычную защиту, освобождая руки.</li><li>Эффект можно прекратить бонусным действием; недееспособность или смерть также прекращают его.</li><li>Длительность отмечается вручную.</li></ul>"
  },
  {
    "id": 338,
    "key": "stand_ground",
    "before": "<p>Когда эффект перемещает вас против воли по земле, уменьшите расстояние этого перемещения на величину до 10 футов.</p>",
    "after": "<ul><li>Когда эффект перемещает вас против воли по земле, уменьшите расстояние этого перемещения на величину до 10 футов.</li></ul>"
  },
  {
    "id": 339,
    "key": "disguise",
    "before": "<p>Выберите внешний вид одежды или другого доспеха. Размер, вес и защитные свойства не меняются. Иллюзия действует до нового применения или снятия доспеха.</p>",
    "after": "<ul><li>Выберите внешний вид одежды или другого доспеха.</li><li>Размер, вес и защитные свойства не меняются.</li><li>Иллюзия действует до нового применения или снятия доспеха.</li></ul>"
  },
  {
    "id": 178,
    "key": "fish_command",
    "before": "<p>Потратьте 1 заряд трезубца, чтобы наложить «Доминирование над зверем» со Сл спасброска 15. Цель — зверь с врождённой скоростью плавания. Примените остальные условия заклинания.</p>",
    "after": "<ul><li>Наложите «Доминирование над зверем».</li><li>Сложность спасброска — 15.</li><li>Действуют остальные условия заклинания.</li></ul>"
  }
]$theses$::jsonb) AS x(id bigint,key text,before text,after text))
UPDATE dndshare.item i SET data=jsonb_set(i.data,'{feature_actions}',
 (SELECT COALESCE(jsonb_agg(CASE WHEN c.key IS NOT NULL THEN jsonb_set(a,'{description}',to_jsonb(c.after)) ELSE a END ORDER BY ord), '[]'::jsonb)
 FROM jsonb_array_elements(i.data->'feature_actions') WITH ORDINALITY rows(a,ord)
 LEFT JOIN changes c ON c.id=i.id AND c.key=a->>'key' AND c.before=a->>'description'))
WHERE i.type_id=19 AND i.user_id IS NULL AND jsonb_typeof(i.data->'feature_actions')='array' AND i.id IN(SELECT id FROM changes);

UPDATE dndshare.item i SET data=jsonb_set(i.data,'{status_effects}',
 (SELECT COALESCE(jsonb_agg(CASE WHEN link->>'key'='withering' AND link->>'condition'='Попадание посохом, потрачен 1 заряд на иссушающий удар; цель провалила спасбросок Телосложения Сл 15. Длительность — 1 час.'
 THEN jsonb_set(link,'{condition}','"Попадание посохом; цель провалила спасбросок Телосложения Сл 15."'::jsonb) ELSE link END ORDER BY ord), '[]'::jsonb)
 FROM jsonb_array_elements(i.data->'status_effects') WITH ORDINALITY rows(link,ord)))
 WHERE i.id=86 AND i.type_id=19 AND i.user_id IS NULL AND jsonb_typeof(i.data->'status_effects')='array';
