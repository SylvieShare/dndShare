"""Reviewed additions against the 2026-09-19 live catalogue. No text inference."""
CHECKS = ['ability_check', 'skill_check']
ALL_ROLLS = ['attack', *CHECKS, 'saving_throw']
def mode(scopes, **kw):
    return {'kind': 'roll_mode', 'mode': 'disadvantage', 'scopes': scopes, **kw}
def bonus(formula, scopes, **kw):
    return {'kind': 'roll_bonus', 'formula': formula, 'scopes': scopes, **kw}
def block(label):
    return {'kind': 'activity_block', 'scopes': ['spellcasting', 'concentration'], 'label': label}
def defenses(types, kind):
    return [{'damage_type': t, 'kind': kind} for t in types]
# Geometric placement, pushing, illumination and scenery stay with the DM.
# Do not include spells with unresolved target-dependent damage, recovery,
# repeated saves, pooled projectiles or death/revival consequences in this set.
FULL_DAMAGE = {
    513, 542, 463, 467, 555, 1009, 470, 471, 482, 1021, 1022, 877,
    891, 593, 1140, 1231, 600, 610, 614, 918, 1399, 1309, 626,
    1054, 504, 924, 1057, 930, 1060, 785, 509, 1315, 517,
    520, 976, 523, 524, 674, 817, 529, 996, 541,
}
EFFECTS = []
def effect(id, key, title, desc, rules=(), *, condition='', duration=None,
           polarity='negative', extra=None, note='', full=False):
    EFFECTS.append(dict(id=id, key=key, title=title, desc=desc, rules=list(rules),
        condition=condition, duration=duration, polarity=polarity, extra=extra or {},
        note=note, full=full))
ROUND = {'kind': 'rounds', 'value': 1}
MINUTE = {'kind': 'minutes', 'value': 1}
MANUAL = {'kind': 'manual'}
POISON = [mode(['attack', *CHECKS])]
effect(497, 'slowed', 'Луч холода: замедление',
       'Скорость уменьшена на 10 футов до начала следующего хода заклинателя.',
       [{'kind': 'speed_bonus', 'value': -10}], condition='После попадания лучом.', duration=ROUND)
effect(483, 'mocked', 'Злая насмешка: помеха атаке',
       'Следующая атака до конца следующего хода цели совершается с помехой. Эффект снимается после атаки.',
       [mode(['attack'])], condition='Цель слышит заклинателя и провалила спасбросок Мудрости.',
       duration=ROUND, extra={'end_on': ['attack']})
effect(503, 'frostbite', 'Обморожение: помеха оружию',
       'Следующая атака оружием до конца следующего хода цели совершается с помехой. После этой атаки снимите эффект.',
       [mode(['attack'], weapon_attacks_only=True)], duration=ROUND,
       condition='Цель провалила спасбросок Телосложения.',
       note='Помеха только оружию. Снятие после подходящей атаки — вручную; атака заклинанием не должна её расходовать.')
effect(632, 'armor', 'Ослабленная броня', 'КД −2 на время концентрации; действует только на носимую броню, не на природный доспех.',
       [{'kind': 'armor_bonus', 'value': -2}], condition='Цель носит броню и провалила спасбросок Телосложения.')
effect(1104, 'despair', 'Эго кнут: отчаяние',
       'Помеха атакам, проверкам и спасброскам; нельзя сотворять заклинания. В конце хода повторите спасбросок Интеллекта; успех снимает эффект.',
       [mode(ALL_ROLLS), {'kind': 'activity_block', 'scopes': ['spellcasting'], 'label': 'Эго кнут'}],
       condition='Цель провалила спасбросок Интеллекта.')
effect(1126, 'mental_saves', 'Духовное разделение: помутнение',
       'Вычитайте 1к6 из спасбросков Интеллекта, Мудрости и Харизмы. В конце хода спасбросок Харизмы может окончить эффект.',
       [bonus('-1d6', ['saving_throw'], ability_ids=[4, 5, 6])],
       condition='Цель провалила первоначальный спасбросок Харизмы.', duration=MINUTE)
effect(1167, 'weakened', 'Пиявка Лей: ослабление',
       'Помеха атакам, проверкам и спасброскам. Повторный спасбросок Телосложения в конце хода оканчивает эффект при успехе.',
       [mode(ALL_ROLLS)], condition='После попадания цель провалила спасбросок Телосложения; не действует на нежить и конструктов.', duration=MANUAL)
effect(898, 'vulnerability', 'Конус шипов: уязвимость',
       'Уязвимость к колющему, дробящему и рубящему урону. В описании не указан срок снятия: его определяет мастер.',
       extra={'defenses': defenses([1, 2, 3], 'vulnerability')},
       condition='Цель провалила спасбросок Ловкости.', duration=MANUAL,
       note='Уязвимости применяются; срок снятия не определён исходным описанием и требует решения мастера.')
effect(1197, 'confused', 'Синоптический разряд: помутнение',
       'Вычитайте 1к6 из атак и проверок. Такой же штраф к спасброскам для концентрации учитывайте вручную. В конце хода спасбросок Интеллекта может снять эффект.',
       [bonus('-1d6', ['attack', *CHECKS])],
       condition='Интеллект цели выше 2; первоначальный спасбросок Интеллекта провален.', duration=MINUTE,
       note='Штраф к атакам и проверкам применяется. Штраф только к поддержанию концентрации, повторные спасброски и снятие — вручную.')
effect(619, 'performance', 'Неземной хор: выступление',
       'Заклинатель совершает проверки Выступления с преимуществом, пока действует хор.',
       [mode(['skill_check'], mode='advantage', skill_ids=[17])],
       condition='Примените к заклинателю.', polarity='positive',
       note='Преимущество Выступлению поддержано. Социальные последствия, спасброски отдельных слушателей и контекстные бонусы — вручную.')
effect(621, 'speed', 'Неутомимость',
       'Скорость передвижения по земле утроена. Не нужны еда, вода и сон; защита только от немагического истощения.',
       [{'kind': 'speed_multiplier', 'value': 3}], polarity='positive',
       note='Тройная скорость поддержана. Расход припасов, отдых и различие магического и немагического истощения — вручную.')
effect(1382, 'defenses', 'Эталон хаоса',
       'Сопротивление физическому урону; иммунитет к яду и психическому урону. Иммунитеты к состояниям и волну хаоса разрешайте по описанию.',
       extra={'defenses': defenses([1, 2, 3], 'resistance') + defenses([4, 11], 'immunity')}, polarity='positive',
       condition='Примените к заклинателю.', note='Защиты от урона поддержаны. Иммунитеты к состояниям и таблица волн хаоса требуют отдельной механики.')
effect(975, 'fur', 'Сила стаи: толстый мех', 'Мех даёт КД +2. Все выбранные существа получают один и тот же вариант заклинания.',
       [{'kind': 'armor_bonus', 'value': 2}], condition='При сотворении выбран вариант «Толстый мех».', polarity='positive',
       note='Вариант КД +2 и его длительность поддержаны. Условные преимущества остальных вариантов требуют контекста броска.')
effect(1342, 'stealth', 'Вредоносные волны: союзник',
       'Преимущество Скрытности, пока союзник находится в 30 футах от заклинателя. При выходе из ауры снимите эффект.',
       [mode(['skill_check'], mode='advantage', skill_ids=[3])], condition='Союзник находится внутри ауры.', polarity='positive')
effect(1342, 'poison', 'Вредоносные волны: враг',
       'Цель отравлена, пока находится внутри ауры: помеха атакам и проверкам. При выходе из ауры снимите эффект.',
       POISON, condition='Враг находится в 30 футах от заклинателя и не имеет иммунитета к отравлению.')
for id, duration, condition, desc in [
    (604, ROUND, 'После попадания лучом провален спасбросок Телосложения.', 'До конца следующего хода заклинателя.'),
    (890, MINUTE, 'После попадания языком провален спасбросок Телосложения.', 'В конце хода повторите спасбросок Телосложения; успех снимает эффект.'),
    (856, MANUAL, 'Провален спасбросок Телосложения.', 'Срок снятия в исходном описании не указан; уточните его у мастера.'),
]:
    effect(id, 'poison', 'Отравление', 'Помеха атакам и проверкам. ' + desc, POISON,
           condition=condition + ' Проверьте иммунитет к состоянию.', duration=duration)
for id, duration, condition, desc in [
    (825, ROUND, 'После попадания тенью провален спасбросок Интеллекта.', 'До начала следующего хода заклинателя.'),
    (1078, ROUND, 'Провален спасбросок Интеллекта.', 'До начала следующего хода заклинателя.'),
]:
    effect(id, 'incapacitated', 'Недееспособность',
           'Нельзя совершать действия и реакции; концентрация прерывается. ' + desc,
           [block('Недееспособность')], condition=condition, duration=duration,
           note='Эффект блокирует сотворение и концентрацию. Остальные действия и реакции пока не блокируются автоматически.')
# Scope is all checks and saves of the physical abilities, not all rolls.
for key, title, value, target in [('caster', 'заклинатель', 'advantage', 'заклинателю'), ('target', 'цель', 'disadvantage', 'поражённой цели')]:
    effect(1100, key, 'Чёрная рука: ' + title,
           ('Преимущество' if value == 'advantage' else 'Помеха') + ' проверкам и спасброскам Силы, Ловкости и Телосложения.',
           [mode([*CHECKS, 'saving_throw'], mode=value, ability_ids=[1, 2, 3])],
           condition='После попадания примените ' + target + '.', polarity='positive' if key == 'caster' else 'negative',
           note='Оба модификатора доступны отдельными вариантами. Наложение на два листа, повторные спасброски и совместное снятие требуют контроля участников.')
# End-on-attack also works for these fallback branches, but the triggering
# inability to make the forced reaction remains a DM decision.
for id in [865, 866]:
    effect(id, 'next_attack', 'Враждебность: следующая атака',
           'Следующая атака до начала следующего хода заклинателя совершается с помехой; после атаки эффект снимается.',
           [mode(['attack'])], duration=ROUND, extra={'end_on': ['attack']},
           condition=('Провален спасбросок Мудрости и в досягаемости цели нет других существ.' if id == 865 else 'Провален спасбросок Мудрости и нельзя совершить вынужденную атаку реакцией.'),
           note='Урон и альтернативная помеха поддержаны. Вынужденная атака реакцией и выбор её цели выполняются участниками.')

effect(1248, 'feast', 'Пир героев: благословение',
       'Преимущество спасброскам Мудрости и иммунитет к урону ядом на 24 часа после окончания пира. Лечение болезней и ядов, иммунитет испугу и увеличение максимума хитов учитывайте отдельно.',
       [mode(['saving_throw'], mode='advantage', ability_ids=[5])],
       duration={'kind': 'hours', 'value': 24}, polarity='positive',
       extra={'defenses': defenses([4], 'immunity')}, condition='Цель участвовала в пире целый час.',
       note='Защита от урона ядом и преимущество Мудрости поддержаны. Увеличение максимума на 2к10 с лечением, снятие болезней/отравления и иммунитет состоянию испуга требуют отдельной механики.')
