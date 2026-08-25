-- A source action may spend a resource contributed by another owned feature.
-- The catalogue stores that relationship; runtime code never matches class or
-- feature names. This is needed by Cutting Words, Channel Divinity options,
-- Combat Wild Shape, ki techniques and sorcery-point features.
WITH addition(field) AS (
  VALUES ('{"name":"ID способности-ресурса","key":"resource_item_id","type":"int"}'::jsonb)
)
UPDATE dndshare.item_type item_type
SET fields = (
  SELECT jsonb_agg(
    CASE WHEN row_field.field ->> 'key' = 'feature_actions' THEN jsonb_set(
      row_field.field,
      '{fields}',
      COALESCE(row_field.field -> 'fields', '[]'::jsonb) || jsonb_build_array(addition.field),
      true
    ) ELSE row_field.field END
    ORDER BY row_field.ord
  )
  FROM jsonb_array_elements(item_type.fields) WITH ORDINALITY AS row_field(field, ord)
  CROSS JOIN addition
)
WHERE item_type.id IN (3, 4, 7)
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements(item_type.fields) field
    WHERE field ->> 'key' = 'feature_actions'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(item_type.fields) field
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(field -> 'fields', '[]'::jsonb)) nested
    WHERE field ->> 'key' = 'feature_actions'
      AND nested ->> 'key' = 'resource_item_id'
  );

-- Only actions with unambiguous action economy are published here. Variable
-- pools remain manually adjustable, while fixed costs receive a one-click
-- resource spend in the action menu.
WITH action_rules(class_id, name_en, resource_name_en, actions) AS (
  VALUES
    (4013, 'Intimidating Presence', NULL, '[{"key":"intimidating_presence","title":"Устрашающее присутствие","action_type":"action","description":"Попытайтесь напугать существо своим присутствием.","requirements":["Существо в пределах 30 футов должно видеть или слышать вас","Цель совершает спасбросок Мудрости"],"priority":30}]'::jsonb),
    (4013, 'Retaliation', NULL, '[{"key":"retaliation","title":"Возмездие","action_type":"reaction","description":"Совершите рукопашную атаку оружием по существу, которое нанесло вам урон.","requirements":["Источник урона находится в пределах 5 футов"],"priority":20}]'::jsonb),

    (4016, 'Bardic Inspiration', NULL, '[{"key":"bardic_inspiration","title":"Вдохновить союзника","action_type":"bonus_action","description":"Передайте слышащему вас существу в пределах 60 футов кость бардовского вдохновения на 10 минут.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4016, 'Cutting Words', 'Bardic Inspiration', '[{"key":"cutting_words","title":"Острое словцо","action_type":"reaction","description":"Вычтите кость вдохновения из броска атаки, проверки характеристики или урона видимого существа.","requirements":["Цель в пределах 60 футов должна слышать вас","Решение принимается до результата броска"],"resource_cost":1,"priority":10}]'::jsonb),
    (4016, 'Countercharm', NULL, '[{"key":"countercharm","title":"Контрочарование","action_type":"action","description":"Начните выступление; слышащие союзники в пределах 30 футов получают преимущество против испуга и очарования до конца вашего следующего хода.","priority":20}]'::jsonb),

    (4377, 'Second Wind', NULL, '[{"key":"second_wind","title":"Второе дыхание","action_type":"bonus_action","description":"Восстановите 1к10 + уровень воина хитов.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4377, 'Action Surge', NULL, '[{"key":"action_surge","title":"Всплеск действий","action_type":"free","description":"Получите одно дополнительное действие в текущем ходу.","requirements":["На 17 уровне доступно два использования, но не более одного за ход"],"uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4377, 'Indomitable', NULL, '[{"key":"indomitable","title":"Несгибаемость","action_type":"special","description":"Перебросьте проваленный спасбросок и используйте новый результат.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),

    (4014, 'Benign Transposition', NULL, '[{"key":"benign_transposition","title":"Благодатная транспозиция","action_type":"action","description":"Телепортируйтесь на 30 футов или поменяйтесь местами с согласным существом Маленького или Среднего размера.","uses_resource":true,"resource_cost":1,"priority":20}]'::jsonb),
    (4014, 'Instinctive Charm', NULL, '[{"key":"instinctive_charm","title":"Инстинктивное очарование","action_type":"reaction","description":"Попытайтесь перенаправить атаку видимого существа на другую доступную цель.","requirements":["Атакующий находится в пределах 30 футов"],"priority":20}]'::jsonb),
    (4014, 'Projected Ward', NULL, '[{"key":"projected_ward","title":"Спроецированная защита","action_type":"reaction","description":"Пусть Магическая защита поглотит урон, получаемый видимым существом в пределах 30 футов.","priority":20}]'::jsonb),
    (4014, 'Illusory Self', NULL, '[{"key":"illusory_self","title":"Иллюзорное я","action_type":"reaction","description":"Создайте иллюзорного двойника и превратите попавшую по вам атаку в промах.","uses_resource":true,"resource_cost":1,"priority":20}]'::jsonb),
    (4014, 'The Third Eye', NULL, '[{"key":"third_eye","title":"Третий глаз","action_type":"action","description":"Получите одно выбранное чувство до короткого или длинного отдыха.","uses_resource":true,"resource_cost":1,"priority":20}]'::jsonb),

    (4019, 'Wild Shape', NULL, '[{"key":"wild_shape","title":"Дикий облик","action_type":"action","description":"Примите облик известного зверя, подходящего по уровню опасности и способам передвижения.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4019, 'Combat Wild Shape', 'Wild Shape', '[{"key":"combat_wild_shape","title":"Боевой дикий облик","action_type":"bonus_action","description":"Примите Дикий облик бонусным действием.","resource_cost":1,"priority":10}]'::jsonb),
    (4019, 'Elemental Wild Shape', 'Wild Shape', '[{"key":"elemental_wild_shape","title":"Облик стихии","action_type":"action","description":"Примите облик воздушного, водяного, земляного или огненного элементаля.","resource_cost":2,"priority":10}]'::jsonb),

    (4020, 'Channel Divinity', NULL, '[{"key":"turn_undead","title":"Изгнать нежить","action_type":"action","description":"Предъявите священный символ; нежить в пределах 30 футов совершает спасбросок Мудрости или становится изгнанной на 1 минуту.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4020, 'War Priest', NULL, '[{"key":"war_priest","title":"Жрец войны","action_type":"bonus_action","description":"После действия Атака совершите одну атаку оружием бонусным действием.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4020, 'Wrath of the Storm', NULL, '[{"key":"wrath_of_the_storm","title":"Гнев бури","action_type":"reaction","description":"Нанесите 2к8 урона электричеством или звуком существу, которое попало по вам атакой.","requirements":["Атакующий находится в пределах 5 футов и видим"],"uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4020, 'Warding Flare', NULL, '[{"key":"warding_flare","title":"Оберегающая вспышка","action_type":"reaction","description":"Дайте помеху броску атаки видимого существа.","requirements":["Атакующий находится в пределах 30 футов","Нужно решить до попадания"],"uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4020, 'Preserve Life', 'Channel Divinity', '[{"key":"preserve_life","title":"Сохранение жизни","action_type":"action","description":"Распределите до пятикратного уровня жреца хитов между существами в пределах 30 футов, не поднимая их выше половины максимума.","resource_cost":1,"priority":20}]'::jsonb),
    (4020, 'Radiance of the Dawn', 'Channel Divinity', '[{"key":"radiance_of_the_dawn","title":"Сияние рассвета","action_type":"action","description":"Рассеяйте магическую тьму и нанесите излучающий урон враждебным существам в пределах 30 футов.","resource_cost":1,"priority":20}]'::jsonb),
    (4020, 'Charm Animals and Plants', 'Channel Divinity', '[{"key":"charm_animals_and_plants","title":"Очарование зверей и растений","action_type":"action","description":"Попытайтесь очаровать зверей и растительных существ в пределах 30 футов на 1 минуту.","resource_cost":1,"priority":20}]'::jsonb),
    (4020, 'Invoke Duplicity', 'Channel Divinity', '[{"key":"invoke_duplicity","title":"Создание двойника","action_type":"action","description":"Создайте иллюзорного двойника на 1 минуту с концентрацией.","resource_cost":1,"priority":20}]'::jsonb),
    (4020, 'Knowledge of the Ages', 'Channel Divinity', '[{"key":"knowledge_of_the_ages","title":"Познание веков","action_type":"action","description":"Получите владение выбранным навыком или инструментом на 10 минут.","resource_cost":1,"priority":20}]'::jsonb),
    (4020, 'Cloak of Shadows', 'Channel Divinity', '[{"key":"cloak_of_shadows","title":"Плащ теней","action_type":"action","description":"Станьте невидимым до конца следующего хода или до атаки либо сотворения заклинания.","resource_cost":1,"priority":20}]'::jsonb),

    (4023, 'Flash of Genius', NULL, '[{"key":"flash_of_genius","title":"Проблеск гениальности","action_type":"reaction","description":"Добавьте модификатор Интеллекта к проверке характеристики или спасброску видимого существа.","requirements":["Цель находится в пределах 30 футов"],"uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),

    (4018, 'Fey Presence', NULL, '[{"key":"fey_presence","title":"Чарующее присутствие","action_type":"action","description":"Попытайтесь очаровать или испугать существ в 10-футовом кубе перед собой до конца следующего хода.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4018, 'Misty Escape', NULL, '[{"key":"misty_escape","title":"Туманный побег","action_type":"reaction","description":"После получения урона станьте невидимым и телепортируйтесь на 60 футов.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4018, 'Dark One''s Own Luck', NULL, '[{"key":"dark_ones_own_luck","title":"Удача Тёмного","action_type":"special","description":"Добавьте 1к10 к своей проверке характеристики или спасброску после броска.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4018, 'Entropic Ward', NULL, '[{"key":"entropic_ward","title":"Энтропийная защита","action_type":"reaction","description":"Дайте помеху атаке по вам; если она промахнётся, получите преимущество на следующую атаку по этому существу.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4018, 'Dark Delirium', NULL, '[{"key":"dark_delirium","title":"Тёмный бред","action_type":"action","description":"Попытайтесь очаровать или испугать видимое существо в пределах 60 футов на 1 минуту с концентрацией.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4018, 'Hurl Through Hell', NULL, '[{"key":"hurl_through_hell","title":"Швырнуть сквозь ад","action_type":"special","description":"После попадания атакой отправьте цель через кошмарный план до конца следующего хода.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),

    (4378, 'Martial Arts', NULL, '[{"key":"martial_arts_attack","title":"Атака боевых искусств","action_type":"bonus_action","description":"После атаки безоружным ударом или монашеским оружием совершите один безоружный удар.","requirements":["Без доспеха и щита","В действии Атака использован безоружный удар или монашеское оружие"],"priority":10}]'::jsonb),
    (4378, 'Ki', NULL, '[{"key":"flurry_of_blows","title":"Шквал ударов","action_type":"bonus_action","description":"Сразу после действия Атака совершите два безоружных удара.","uses_resource":true,"resource_cost":1,"priority":10},{"key":"patient_defense","title":"Терпеливая оборона","action_type":"bonus_action","description":"Совершите действие Уклонение бонусным действием.","suggest_action_codes":["dodge"],"uses_resource":true,"resource_cost":1,"priority":20},{"key":"step_of_the_wind","title":"Шаг ветра","action_type":"bonus_action","description":"Совершите Рывок или Отход бонусным действием; дальность прыжка удваивается на этот ход.","suggest_action_codes":["dash","disengage"],"uses_resource":true,"resource_cost":1,"priority":30}]'::jsonb),
    (4378, 'Deflect Missiles', NULL, '[{"key":"deflect_missiles","title":"Отражение снарядов","action_type":"reaction","description":"Уменьшите урон от попавшей по вам дальнобойной атаки оружием на 1к10 + Ловкость + уровень монаха.","requirements":["Если урон снижен до 0, снаряд можно метнуть обратно за 1 ци"],"priority":10}]'::jsonb),
    (4378, 'Slow Fall', NULL, '[{"key":"slow_fall","title":"Медленное падение","action_type":"reaction","description":"Уменьшите урон от падения на пятикратный уровень монаха.","priority":10}]'::jsonb),
    (4378, 'Stunning Strike', 'Ki', '[{"key":"stunning_strike","title":"Ошеломляющий удар","action_type":"special","description":"После попадания рукопашной атакой оружием заставьте цель совершить спасбросок Телосложения или стать ошеломлённой до конца вашего следующего хода.","resource_cost":1,"priority":10}]'::jsonb),
    (4378, 'Wholeness of Body', NULL, '[{"key":"wholeness_of_body","title":"Целостность тела","action_type":"action","description":"Восстановите хиты в количестве, равном утроенному уровню монаха.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4378, 'Stillness of Mind', NULL, '[{"key":"stillness_of_mind","title":"Спокойствие разума","action_type":"action","description":"Завершите на себе один эффект очарования или испуга.","priority":10}]'::jsonb),
    (4378, 'Shadow Step', NULL, '[{"key":"shadow_step","title":"Теневой шаг","action_type":"bonus_action","description":"Телепортируйтесь на 60 футов между участками тусклого света или тьмы и получите преимущество на первую рукопашную атаку до конца хода.","priority":10}]'::jsonb),
    (4378, 'Cloak of Shadows', NULL, '[{"key":"cloak_of_shadows","title":"Плащ теней","action_type":"action","description":"Станьте невидимым в тусклом свете или тьме до атаки, заклинания или выхода на яркий свет.","priority":10}]'::jsonb),

    (4021, 'Divine Sense', NULL, '[{"key":"divine_sense","title":"Божественное чувство","action_type":"action","description":"До конца следующего хода обнаруживайте небожителей, исчадий, нежить и освящённые места в пределах 60 футов.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4021, 'Lay on Hands', NULL, '[{"key":"lay_on_hands","title":"Наложение рук","action_type":"action","description":"Касанием восстановите выбранное количество хитов из доступного запаса либо потратьте 5 хитов запаса на лечение болезни или нейтрализацию яда.","uses_resource":true,"priority":10}]'::jsonb),
    (4021, 'Cleansing Touch', NULL, '[{"key":"cleansing_touch","title":"Очищающее касание","action_type":"action","description":"Завершите одно заклинание на себе или согласном существе касанием.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4021, 'Nature''s Wrath', NULL, '[{"key":"natures_wrath","title":"Гнев природы","action_type":"action","description":"Попытайтесь опутать видимое существо призрачными лозами.","requirements":["Расходует Божественный канал паладина; счётчик пока ведётся вручную"],"priority":20}]'::jsonb),
    (4021, 'Turn the Faithless', NULL, '[{"key":"turn_the_faithless","title":"Изгнание неверных","action_type":"action","description":"Попытайтесь изгнать слышащих вас фей и исчадий в пределах 30 футов.","requirements":["Расходует Божественный канал паладина; счётчик пока ведётся вручную"],"priority":20}]'::jsonb),
    (4021, 'Turn the Unholy', NULL, '[{"key":"turn_the_unholy","title":"Изгнание нечестивого","action_type":"action","description":"Попытайтесь изгнать слышащих вас исчадий и нежить в пределах 30 футов.","requirements":["Расходует Божественный канал паладина; счётчик пока ведётся вручную"],"priority":20}]'::jsonb),
    (4021, 'Abjure Enemy', NULL, '[{"key":"abjure_enemy","title":"Отречение врага","action_type":"action","description":"Попытайтесь напугать видимое существо в пределах 60 футов на 1 минуту.","requirements":["Расходует Божественный канал паладина; счётчик пока ведётся вручную"],"priority":20}]'::jsonb),
    (4021, 'Vow of Enmity', NULL, '[{"key":"vow_of_enmity","title":"Клятвенный враг","action_type":"bonus_action","description":"Получите преимущество на атаки по видимому существу в пределах 10 футов на 1 минуту.","requirements":["Расходует Божественный канал паладина; счётчик пока ведётся вручную"],"priority":20}]'::jsonb),
    (4021, 'Sacred Weapon', NULL, '[{"key":"sacred_weapon","title":"Священное оружие","action_type":"action","description":"На 1 минуту добавьте Харизму к атакам выбранным оружием и заставьте его излучать свет.","requirements":["Расходует Божественный канал паладина; счётчик пока ведётся вручную"],"priority":20}]'::jsonb),

    (4022, 'Primeval Awareness', NULL, '[{"key":"primeval_awareness","title":"Первобытное чутьё","action_type":"action","description":"Потратьте ячейку следопыта, чтобы почувствовать присутствие определённых типов существ в регионе.","requirements":["Длительность — 1 минута за круг потраченной ячейки"],"priority":10}]'::jsonb),
    (4022, 'Vanish', NULL, '[{"key":"vanish","title":"Исчезновение","action_type":"bonus_action","description":"Совершите действие Засада бонусным действием.","suggest_action_codes":["hide"],"priority":10}]'::jsonb),

    (4017, 'Font of Magic', NULL, '[{"key":"create_spell_slot","title":"Создать ячейку заклинания","action_type":"bonus_action","description":"Преобразуйте очки чародейства во временную ячейку не выше 5 круга.","uses_resource":true,"requirements":["Стоимость зависит от круга создаваемой ячейки; измените оба счётчика вручную"],"priority":10},{"key":"convert_spell_slot","title":"Преобразовать ячейку в очки","action_type":"bonus_action","description":"Потратьте ячейку и получите число очков чародейства, равное её кругу.","uses_resource":true,"requirements":["Измените оба счётчика вручную"],"priority":20}]'::jsonb),
    (4017, 'Tides of Chaos', NULL, '[{"key":"tides_of_chaos","title":"Прилив хаоса","action_type":"special","description":"Получите преимущество на одну атаку, проверку характеристики или спасбросок.","uses_resource":true,"resource_cost":1,"priority":10}]'::jsonb),
    (4017, 'Bend Luck', 'Font of Magic', '[{"key":"bend_luck","title":"Искажение удачи","action_type":"reaction","description":"Добавьте или вычтите 1к4 из броска атаки, проверки характеристики или спасброска видимого существа.","resource_cost":2,"priority":10}]'::jsonb),
    (4017, 'Dragon Wings', NULL, '[{"key":"dragon_wings","title":"Драконьи крылья","action_type":"bonus_action","description":"Создайте или уберите драконьи крылья; пока они раскрыты, ваша скорость полёта равна текущей скорости.","priority":10}]'::jsonb),
    (4017, 'Draconic Presence', 'Font of Magic', '[{"key":"draconic_presence","title":"Драконье присутствие","action_type":"action","description":"Создайте ауру очарования или страха радиусом 60 футов с концентрацией до 1 минуты.","resource_cost":5,"priority":10}]'::jsonb)
), resolved_rules AS (
  SELECT rules.*,
         resource.id AS resource_item_id
  FROM action_rules rules
  LEFT JOIN dndshare.item resource
    ON resource.type_id = 4
   AND resource.user_id IS NULL
   AND rules.resource_name_en IS NOT NULL
   AND lower(COALESCE(resource.name_en, '')) = lower(rules.resource_name_en)
   AND EXISTS (
     SELECT 1
     FROM jsonb_array_elements(COALESCE(resource.data -> 'class_ids', '[]'::jsonb)) class_ref
     WHERE (class_ref ->> 'id')::bigint = rules.class_id
   )
), rendered_rules AS (
  SELECT resolved_rules.class_id,
         resolved_rules.name_en,
         CASE WHEN resolved_rules.resource_name_en IS NULL OR resolved_rules.resource_item_id IS NULL THEN resolved_rules.actions ELSE (
           SELECT jsonb_agg(
             action.value || jsonb_build_object('resource_item_id', resolved_rules.resource_item_id)
             ORDER BY action.ord
           )
           FROM jsonb_array_elements(resolved_rules.actions) WITH ORDINALITY AS action(value, ord)
         ) END AS actions
  FROM resolved_rules
)
UPDATE dndshare.item target
SET data = jsonb_set(COALESCE(target.data, '{}'::jsonb), '{feature_actions}', rendered_rules.actions, true)
FROM rendered_rules
WHERE target.type_id = 4
  AND target.user_id IS NULL
  AND lower(COALESCE(target.name_en, '')) = lower(rendered_rules.name_en)
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(target.data -> 'class_ids', '[]'::jsonb)) class_ref
    WHERE (class_ref ->> 'id')::bigint = rendered_rules.class_id
  );
