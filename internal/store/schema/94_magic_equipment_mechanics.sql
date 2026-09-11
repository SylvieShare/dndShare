-- Audited public equipment, SRD 5.1. Add supported mechanics without replacing authored fields.
-- Damage conditions and target-side consequences remain explicit player decisions.
WITH patches AS (
  SELECT * FROM jsonb_to_recordset($mechanics$
[
  {
    "id": 85,
    "name": "Танцующий меч",
    "patch": {
      "feature_actions": [
        {"key": "dance", "title": "Подбросить или направить меч", "action_type": "bonus_action", "description": "<p>Бонусным действием меч летит до 30 футов и атакует выбранное существо в пределах 5 футов от него, используя ваш бросок атаки и модификатор урона. После четвёртой атаки он возвращается. Дистанцию, число атак и свободную руку отслеживайте по описанию.</p>"}
      ]
    }
  },
  {
    "id": 104,
    "name": "Святой мститель",
    "patch": {
      "weapon_damage": [
        {"key": "holy_damage", "label": "Исчадие или нежить", "dice": "d10", "dice_count": 2, "condition": "Попадание по исчадию или нежити: дополнительный урон излучением.", "double_on_critical": true}
      ]
    }
  },
  {
    "id": 114,
    "name": "Доспех из драконьей чешуи",
    "patch": {
      "choices": [
        {"key": "dragon_scale", "text": "Выберите вид дракона, из чешуи которого сделан доспех (определяет мастер).", "count": 1, "source": "inline", "options": [{"value": "black", "label": "Чёрный — кислота"}, {"value": "blue", "label": "Синий — молния"}, {"value": "brass", "label": "Латунный — огонь"}, {"value": "bronze", "label": "Бронзовый — молния"}, {"value": "copper", "label": "Медный — кислота"}, {"value": "gold", "label": "Золотой — огонь"}, {"value": "green", "label": "Зелёный — яд"}, {"value": "red", "label": "Красный — огонь"}, {"value": "silver", "label": "Серебряный — холод"}, {"value": "white", "label": "Белый — холод"}]}
      ],
      "choice_defenses": [
        {"source_item_id": 114, "choice_key": "dragon_scale", "options": [{"value": "black", "damage_type": 8, "kind": "resistance"}, {"value": "blue", "damage_type": 9, "kind": "resistance"}, {"value": "brass", "damage_type": 5, "kind": "resistance"}, {"value": "bronze", "damage_type": 9, "kind": "resistance"}, {"value": "copper", "damage_type": 8, "kind": "resistance"}, {"value": "gold", "damage_type": 5, "kind": "resistance"}, {"value": "green", "damage_type": 4, "kind": "resistance"}, {"value": "red", "damage_type": 5, "kind": "resistance"}, {"value": "silver", "damage_type": 13, "kind": "resistance"}, {"value": "white", "damage_type": 13, "kind": "resistance"}]}
      ],
      "max_use": 1,
      "recharge_note": "На рассвете восстанавливается поиск дракона. Восстановление отмечается вручную; отдых не заменяет это событие.",
      "feature_actions": [
        {"key": "detect_dragon", "title": "Найти дракона", "action_type": "action", "description": "<p>Определите направление и расстояние до ближайшего дракона выбранного вида в пределах 30 миль. Поиск расходует использование доспеха.</p>", "uses_resource": true, "resource_cost": 1}
      ],
      "passive_effects": [
        {"title": "Защита от драконов", "description": "<p>Преимущество спасбросков против Ужасающего присутствия и дыхания драконов. Выберите преимущество при соответствующем броске.</p>"}
      ]
    }
  },
  {
    "id": 131,
    "name": "Посох огня",
    "patch": {
      "defenses": [
        {"damage_type": 5, "kind": "resistance"}
      ]
    }
  },
  {
    "id": 136,
    "name": "Пламенный язык",
    "patch": {
      "weapon_damage": [
        {"key": "flame", "label": "Горящий клинок", "dice": "d6", "dice_count": 2, "condition": "Клинок зажжён бонусным действием: дополнительный урон огнём. Выключите после тушения, убирания или падения меча.", "double_on_critical": true}
      ],
      "feature_actions": [
        {"key": "ignite", "title": "Зажечь или погасить клинок", "action_type": "bonus_action", "description": "<p>Произнесите командное слово. Горящий меч освещает 40 футов ярко и ещё 40 тускло. Для урона включите «Горящий клинок» в меню меча; выключите после тушения, убирания или падения меча.</p>"}
      ]
    }
  },
  {
    "id": 137,
    "name": "Булава сокрушения",
    "patch": {
      "weapon_damage": [
        {"key": "smiting", "label": "Натуральная 20", "dice": "d6", "dice_count": 2, "condition": "На к20 атаки выпало 20: дополнительный дробящий урон.", "double_on_critical": false},
        {"key": "smiting_construct", "label": "Цель — конструкт", "dice": "d6", "dice_count": 2, "condition": "При натуральной 20 по конструкту добавьте ещё 2к6: всего 4к6 дробящего урона.", "double_on_critical": false, "requires_damage_key": "smiting"}
      ]
    }
  },
  {
    "id": 148,
    "name": "Морозная марка",
    "patch": {
      "weapon_damage": [
        {"key": "frost", "label": "Холод клинка", "dice": "d6", "dice_count": 1, "condition": "При попадании этим мечом: дополнительный урон холодом.", "double_on_critical": true}
      ],
      "defenses": [
        {"damage_type": 5, "kind": "resistance"}
      ]
    }
  },
  {
    "id": 149,
    "name": "Кинжал яда",
    "patch": {
      "max_use": 1,
      "recharge_note": "На рассвете можно снова покрыть кинжал ядом. Восстановление отмечается вручную; отдых не заменяет это событие.",
      "feature_actions": [
        {"key": "apply_poison", "title": "Покрыть кинжал ядом", "action_type": "action", "description": "<p>Яд действует 1 минуту или до следующего попадания. При попадании цель совершает спасбросок Телосложения Сл 15: при провале получает 2к10 урона ядом и отравлена 1 минуту. Бросок урона ядом выполняется отдельно, без удвоения при крите.</p>", "uses_resource": true, "resource_cost": 1}
      ]
    }
  },
  {
    "id": 160,
    "name": "Меч остроты",
    "patch": {
      "weapon_damage": [
        {"key": "sharpness", "label": "Натуральная 20", "dice": "d6", "dice_count": 4, "condition": "На к20 атаки по существу выпало 20: дополнительный рубящий урон. Затем отдельно бросьте к20 на отсечение конечности.", "double_on_critical": false}
      ]
    }
  },
  {
    "id": 182,
    "name": "Убийца великанов",
    "patch": {
      "weapon_damage": [
        {"key": "giant_slayer", "label": "Цель — великан", "dice": "d6", "dice_count": 2, "condition": "Попадание по великану: дополнительный урон типа оружия. Цель совершает спасбросок Силы Сл 15 или падает ничком.", "double_on_critical": true}
      ]
    }
  },
  {
    "id": 187,
    "name": "Доспех уязвимости",
    "patch": {
      "choices": [
        {"key": "resistance_type", "text": "Выберите тип сопротивления, который назначил мастер. Проклятие оформляется отдельно и не исчезает при снятии доспеха.", "count": 1, "source": "inline", "options": [{"value": "bludgeoning", "label": "Дробящий"}, {"value": "piercing", "label": "Колющий"}, {"value": "slashing", "label": "Рубящий"}]}
      ],
      "choice_defenses": [
        {"source_item_id": 187, "choice_key": "resistance_type", "options": [{"value": "bludgeoning", "damage_type": 3, "kind": "resistance"}, {"value": "piercing", "damage_type": 1, "kind": "resistance"}, {"value": "slashing", "damage_type": 2, "kind": "resistance"}]}
      ]
    }
  },
  {
    "id": 190,
    "name": "Булава разрушения",
    "patch": {
      "weapon_damage": [
        {"key": "disruption", "label": "Исчадие или нежить", "dice": "d6", "dice_count": 2, "condition": "Попадание по исчадию или нежити: дополнительный урон излучением. При остатке хитов не более 25 примените спасбросок из описания.", "double_on_critical": true}
      ]
    }
  },
  {
    "id": 198,
    "name": "Ворпальный меч",
    "patch": {
      "weapon_damage": [
        {"key": "vorpal", "label": "Вместо обезглавливания", "dice": "d8", "dice_count": 6, "condition": "На к20 атаки выпало 20, но цель невосприимчива к обезглавливанию по условиям меча: дополнительный рубящий урон.", "double_on_critical": false}
      ]
    }
  },
  {
    "id": 202,
    "name": "Лук клятвы",
    "patch": {
      "weapon_damage": [
        {"key": "sworn_enemy", "label": "Заклятый враг", "dice": "d6", "dice_count": 3, "condition": "Дальняя атака по объявленному заклятому врагу: дополнительный колющий урон. Преимущество и исключения для укрытия/дистанции применяются отдельно.", "double_on_critical": true}
      ]
    }
  },
  {
    "id": 228,
    "name": "Доспех сопротивления",
    "patch": {
      "choices": [
        {"key": "resistance_type", "text": "Выберите тип сопротивления, который назначил мастер.", "count": 1, "source": "inline", "options": [{"value": "8", "label": "Кислота"}, {"value": "13", "label": "Холод"}, {"value": "5", "label": "Огонь"}, {"value": "12", "label": "Силовое поле"}, {"value": "9", "label": "Молния"}, {"value": "10", "label": "Некротическая энергия"}, {"value": "4", "label": "Яд"}, {"value": "11", "label": "Психическая энергия"}, {"value": "7", "label": "Излучение"}, {"value": "6", "label": "Гром"}]}
      ],
      "choice_defenses": [
        {"source_item_id": 228, "choice_key": "resistance_type", "options": [{"value": "8", "damage_type": 8, "kind": "resistance"}, {"value": "13", "damage_type": 13, "kind": "resistance"}, {"value": "5", "damage_type": 5, "kind": "resistance"}, {"value": "12", "damage_type": 12, "kind": "resistance"}, {"value": "9", "damage_type": 9, "kind": "resistance"}, {"value": "10", "damage_type": 10, "kind": "resistance"}, {"value": "4", "damage_type": 4, "kind": "resistance"}, {"value": "11", "damage_type": 11, "kind": "resistance"}, {"value": "7", "damage_type": 7, "kind": "resistance"}, {"value": "6", "damage_type": 6, "kind": "resistance"}]}
      ]
    }
  },
  {
    "id": 263,
    "name": "Солнечный клинок",
    "patch": {
      "weapon_damage": [
        {"key": "undead", "label": "Цель — нежить", "dice": "d8", "dice_count": 1, "condition": "Попадание проявленным клинком по нежити: дополнительный урон излучением.", "double_on_critical": true}
      ],
      "feature_actions": [
        {"key": "blade", "title": "Проявить или скрыть клинок", "action_type": "bonus_action", "description": "<p>Бонусным действием проявите или скройте клинок. Пока он проявлен, действуют оружейные свойства и солнечный свет: 15 футов яркого и ещё 15 футов тусклого.</p>"},
        {"key": "sunlight", "title": "Изменить яркость клинка", "action_type": "action", "description": "<p>Увеличьте или уменьшите радиусы яркого и тусклого солнечного света на 5 футов каждый. Пределы каждого радиуса — от 10 до 30 футов. Требуется проявленный клинок.</p>"}
      ]
    }
  },
  {
    "id": 273,
    "name": "Булава ужаса",
    "patch": {
      "max_use": 3,
      "recharge_note": "На рассвете восстанавливаются 1к3 израсходованных заряда, максимум 3. Восстановление отмечается вручную; отдых не заменяет это событие.",
      "feature_actions": [
        {"key": "terror", "title": "Волна ужаса", "action_type": "action", "description": "<p>Выбранные существа в пределах 30 футов совершают спасбросок Мудрости Сл 15 или испуганы на 1 минуту. Они удаляются от вас, не реагируют; ограничения действий и повторный спасбросок в конце каждого хода — по описанию булавы.</p>", "uses_resource": true, "resource_cost": 1}
      ]
    }
  },
  {
    "id": 286,
    "name": "Жестокое оружие",
    "patch": {
      "weapon_damage": [
        {"key": "vicious", "label": "Натуральная 20", "dice": "d6", "dice_count": 2, "condition": "На к20 атаки выпало 20: дополнительный урон типа оружия к критическому попаданию.", "double_on_critical": false}
      ]
    }
  },
  {
    "id": 289,
    "name": "Латы эфирности",
    "patch": {
      "max_use": 1,
      "recharge_note": "На рассвете восстанавливается использование эфирности. Восстановление отмечается вручную; отдых не заменяет это событие.",
      "feature_actions": [
        {"key": "etherealness", "title": "Стать эфирным", "action_type": "action", "description": "<p>Произнесите командное слово и получите эффект «Эфирность» на 10 минут. Эффект заканчивается при снятии лат или повторном произнесении слова действием.</p>", "uses_resource": true, "resource_cost": 1},
        {"key": "end_etherealness", "title": "Завершить эфирность", "action_type": "action", "description": "<p>Повторите командное слово, чтобы досрочно прекратить эфирность. Не расходует новое использование.</p>"}
      ]
    }
  },
  {
    "id": 293,
    "name": "Меч похищения жизни",
    "patch": {
      "weapon_damage": [
        {"key": "life_stealing", "label": "Похищение жизни", "dice": "d6", "dice_count": 3, "condition": "На к20 атаки выпало 20, цель не конструкт и не нежить: некротический урон. Временные хиты по нанесённому дополнительному урону отметьте вручную.", "double_on_critical": false}
      ]
    }
  },
  {
    "id": 297,
    "name": "Посох мороза",
    "patch": {
      "defenses": [
        {"damage_type": 13, "kind": "resistance"}
      ]
    }
  },
  {
    "id": 321,
    "name": "Убийца драконов",
    "patch": {
      "weapon_damage": [
        {"key": "dragon_slayer", "label": "Цель — дракон", "dice": "d6", "dice_count": 3, "condition": "Попадание по существу типа «дракон»: дополнительный урон типа оружия.", "double_on_critical": true}
      ]
    }
  },
  {
    "id": 325,
    "name": "Скимитар скорости",
    "patch": {
      "feature_actions": [
        {"key": "swift_attack", "title": "Атака скимитаром", "action_type": "bonus_action", "description": "<p>Совершите одну атаку этим скимитаром бонусным действием в свой ход. Используйте обычное меню броска этого экземпляра.</p>"}
      ]
    }
  },
  {
    "id": 332,
    "name": "Оживлённый щит",
    "patch": {
      "feature_actions": [
        {"key": "animate", "title": "Оживить или остановить щит", "action_type": "bonus_action", "description": "<p>Произнесите командное слово. Щит парит в вашем пространстве 1 минуту и даёт обычную защиту, освобождая руки. Эффект можно прекратить бонусным действием; недееспособность или смерть также прекращают его. Длительность отмечается вручную.</p>"}
      ]
    }
  },
  {
    "id": 338,
    "name": "Дварфийские латы",
    "patch": {
      "feature_actions": [
        {"key": "stand_ground", "title": "Устоять на месте", "action_type": "reaction", "description": "<p>Когда эффект перемещает вас против воли по земле, уменьшите расстояние этого перемещения на величину до 10 футов.</p>"}
      ]
    }
  },
  {
    "id": 339,
    "name": "Иллюзорный клёпаный кожаный доспех",
    "patch": {
      "feature_actions": [
        {"key": "disguise", "title": "Изменить облик доспеха", "action_type": "bonus_action", "description": "<p>Выберите внешний вид одежды или другого доспеха. Размер, вес и защитные свойства не меняются. Иллюзия действует до нового применения или снятия доспеха.</p>"}
      ]
    }
  }
]
$mechanics$::jsonb) AS p(id bigint, name text, patch jsonb)
)
UPDATE dndshare.item i
SET data=i.data || COALESCE((SELECT jsonb_object_agg(e.key,e.value)
  FROM jsonb_each(p.patch) e WHERE NOT i.data ? e.key),'{}'::jsonb)
FROM patches p
WHERE i.id=p.id AND i.name=p.name AND i.type_id=19 AND i.user_id IS NULL;

-- Correct verified translation errors; retain rich text, artwork and all other text.
UPDATE dndshare.item SET data=jsonb_set(data,'{desc}',to_jsonb(replace(data->>'desc',
  'а атаки заклинаниями имеют преимущество против вас','а атаки заклинаниями совершаются с помехой против вас')))
WHERE id=117 AND type_id=19 AND user_id IS NULL AND name='Щит защиты от заклинаний'
AND data->>'desc' LIKE '%а атаки заклинаниями имеют преимущество против вас%';
UPDATE dndshare.item SET data=jsonb_set(data,'{desc}',to_jsonb(replace(data->>'desc',
  'сократить расстояние, на которое вы перемещаетесь, до 10 футов','уменьшить расстояние этого перемещения на величину до 10 футов')))
WHERE id=338 AND type_id=19 AND user_id IS NULL AND name='Дварфийские латы'
AND data->>'desc' LIKE '%сократить расстояние, на которое вы перемещаетесь, до 10 футов%';
UPDATE dndshare.item SET data=jsonb_set(data,'{desc}',to_jsonb(replace(data->>'desc',
  'увеличьте свои кубики урона от оружия по цели','используйте максимальные значения костей урона оружия по этой цели')))
WHERE id=160 AND type_id=19 AND user_id IS NULL AND name='Меч остроты'
AND data->>'desc' LIKE '%увеличьте свои кубики урона от оружия по цели%';
UPDATE dndshare.item SET data=jsonb_set(data,'{desc}',to_jsonb(replace(data->>'desc',
  'демона или нежить','исчадие или нежить')))
WHERE type_id=19 AND user_id IS NULL
AND ((id=104 AND name='Святой мститель') OR (id=190 AND name='Булава разрушения'))
AND data->>'desc' LIKE '%демона или нежить%';
