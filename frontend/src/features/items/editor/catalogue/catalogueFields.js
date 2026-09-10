import { isFieldVisible } from '@/features/handbook/objects/lib/schemaFields'
const select = (name, pairs) => ({ name, type: 'select', options: pairs.map(([value, label]) => ({ value, label })) })
const optional = { optional: true }
const bonusFields = [{ key: 'ability', name: 'Характеристика', type: 'suggest', suggest_id: 16 }, { key: 'bonus', name: 'Прибавка', type: 'int', default: 1 }]
const rollFields = { count: { name: 'Костей', min: 1 }, dice_id: { name: 'Кость', type: 'dice' }, type: { name: 'Тип урона' }, bonus: { name: 'Постоянная прибавка' } }
const common = {
  desc: { hint: 'Правила и описание объекта. Можно вставить бросок костей или ссылку на справочник.' },
  description: { hint: 'Описание, которое увидит игрок. Можно вставить броски и ссылки на другие записи.' },
  short_description: { name: 'Короткое представление', hint: 'Один-два предложения для шапки карточки.' },
  cost: { hint: 'Цена одного предмета в выбранной валюте.' },
  weight: { name: 'Вес, фнт.', type: 'float', min: 0, hint: 'Вес одного предмета в фунтах. Можно указать дробное значение.' },
  available_in_starting_shop: { name: 'Продавать при создании персонажа', hint: 'Предмет появится среди покупок за стартовое золото.' },
  suggest_id: { name: 'Связь со словарём правил', hint: 'Необязательная связь с существующей расой или классом в словаре. Выбирайте по названию.' },
  asi: { name: 'Прибавки характеристик', rowName: 'Прибавка', fields: bonusFields },
  asi_choice: { ...optional, name: 'Характеристики на выбор' },
  lang_choice: { ...optional, name: 'Языки на выбор' },
  skill_choice: { ...optional, name: 'Навыки на выбор' },
  tool_prof_choice: { ...optional, name: 'Инструменты на выбор' },
  feat_choice: { ...optional, name: 'Черта на выбор' },
  'asi_choice.count': { name: 'Сколько характеристик', min: 1 },
  'asi_choice.bonus': { name: 'Прибавка каждой', min: 1 },
  'skill_choice.from': { name: 'Доступные навыки', hint: 'Пустой список позволяет выбрать любой навык.' },
  'lang_choice.from': { name: 'Доступные языки', hint: 'Пустой список позволяет выбрать любой язык.' },
  'tool_prof_choice.from': { name: 'Доступные владения' },
  'armor.shield': { name: 'Щит', hint: 'Щит добавляет бонус к имеющемуся КД; доспех задаёт основу КД.' },
  'armor.use_dex': { name: 'Добавлять модификатор Ловкости' },
  'armor.dex_cap': { name: 'Предел бонуса Ловкости', hint: 'Пусто — без ограничения. Например, 2 для среднего доспеха.', min: 0 },
  'armor.ac': { name: 'Основа КД', min: 0 },
  'armor.shield_bonus': { name: 'Прибавка к КД', min: 0 },
  'duration.kind': { name: 'Когда заканчивается' },
  'duration.value': { name: 'Длительность', min: 1 },
  attacks: { name: 'Урон оружия', rowName: 'Составляющая урона', hint: 'Добавьте по строке на каждый тип урона.' },
  universe_attacks: { name: 'Урон двумя руками', rowName: 'Составляющая урона' },
  range_min: { name: 'Обычная дистанция, фт.', min: 0, hint: 'До этой дистанции атака не получает помеху за дальность.' },
  range_max: { name: 'Предельная дистанция, фт.', min: 0, hint: 'Максимальная дистанция атаки; дальше обычной дистанции применяется помеха.' },
  contents: { rowName: 'Предмет набора' }, tool_items: { rowName: 'Инструмент' }, equipment_items: { rowName: 'Предмет' },
  starting_coins: { rowName: 'Монеты' }, class_resources: { rowName: 'Ресурс' },
  'class_resources.title': { name: 'Название ресурса' },
  'class_resources.key': { createKey: true },
  'class_resources.scaling': { name: 'Изменение максимума с уровнем', rowName: 'Изменение', optional: true },
  'class_resources.scaling.level': { min: 1, max: 20, name: 'С уровня класса' },
  'class_resources.scaling.uses': { name: 'Максимум использований', min: 0 },
  'class_resources.level': { name: 'Доступен с уровня класса', min: 1, max: 20 },
  'class_resources.max_use': { name: 'Начальный максимум', min: 0, hint: 'Действует до первой строки прогрессии. 0 — без ограничения.' },
  asi_levels: { type: 'level_set', name: 'Уровни прироста характеристик', hint: 'Отметьте уровни класса, на которых персонаж получает прирост характеристик или черту.' },
  subclass_level: { name: 'Уровень выбора подкласса', min: 1, max: 20 },
  'spellcasting.note': { name: 'Правила заклинательства' },
  'spellcasting.cantrips_known': { name: 'Заговоров при получении', min: 0 },
  'spellcasting.spells_known': { name: 'Заклинаний при получении', min: 0 },
  'spellcasting.known_progression': { ...optional, name: 'Число заклинаний по уровням', rowName: 'Изменение' },
  'spellcasting.unrestricted_progression': { ...optional, name: 'Исключения из ограничения школ', rowName: 'Изменение' },
  granted_spells: { rowName: 'Заклинание' },
  derived_effects: { rowName: 'Правило' }, defenses: { rowName: 'Защита' },
  spellcasting_ability: { ...optional, name: 'Отдельная характеристика после первого уровня', hint: 'Задайте только если она отличается от основной заклинательной характеристики класса.' },
  'spellcasting.list_class': { ...optional, name: 'Использовать список другого класса' },
  'spellcasting.allowed_schools': { ...optional, name: 'Ограничить школы заклинаний' },
}
const byType = {
  2: { armor: { name: 'Правило защиты' }, unit_cost_copper: { name: 'Цена одного фута, мм', min: 0 }, unit_weight: { name: 'Вес одного фута, фнт.', type: 'float', min: 0 } },
  5: {
    lvl: { name: 'Круг заклинания', min: 0, max: 9, hint: '0 — заговор, 1–9 — круг заклинания.' },
    time: { name: 'Время сотворения', placeholder: '1 действие' }, range: { name: 'Дистанция', placeholder: '60 футов' },
    duration: { hint: 'Например: мгновенная или до 1 минуты. Концентрация задаётся отдельным флажком.' },
    components: { name: 'Компоненты' }, 'components.v': { name: 'Вербальный (В)' }, 'components.s': { name: 'Соматический (С)' },
    'components.m': { name: 'Материальный компонент (М)', type: 'textarea', optional: true, hint: 'Укажите материалы, стоимость и расходование, если они требуются.' },
    'damage.range_attack': { name: 'Бросок атаки заклинанием' },
    'damage.save_ability': { ...select('Спасбросок цели', [['str', 'Сила'], ['dex', 'Ловкость'], ['con', 'Телосложение'], ['int', 'Интеллект'], ['wis', 'Мудрость'], ['cha', 'Харизма']]), emptyLabel: 'Нет спасброска' },
    'damage.save_effect': { ...select('При успешном спасброске', [['half', 'Половина урона'], ['none', 'Без урона']]), emptyLabel: 'Как в описании' },
    'damage.scaling': select('Рост урона', [['slot', 'За каждый круг ячейки выше базового'], ['cantrip', 'С уровнем персонажа: 5, 11, 17']]),
    'heal.scaling': select('Рост лечения', [['slot', 'За каждый круг ячейки выше базового'], ['cantrip', 'С уровнем персонажа: 5, 11, 17']]),
    'damage.instances': { name: 'Снарядов или лучей', min: 1, hint: 'Количество отдельных попаданий. Для обычного заклинания — 1.' },
    'damage.addon_instances': { name: 'Дополнительных снарядов за шаг роста', min: 0 },
    'damage.dices': { name: 'Урон одного попадания', rowName: 'Составляющая урона' },
    'heal.dices': { name: 'Восстановление хитов', rowName: 'Кости лечения' },
    'damage.addon': { name: 'Дополнительный урон за шаг роста', rowName: 'Прибавка урона' },
    'heal.addon': { name: 'Дополнительное лечение за шаг роста', rowName: 'Прибавка лечения' },
    'heal.add_mod': { name: 'Добавлять модификатор заклинательной характеристики' },
    status_effects: { rowName: 'Эффект' },
  },
  6: {
    identity: { name: 'Вид существа' }, 'identity.source': { name: 'Сокращение публикации', optional: true },
    'combat.cr': { name: 'Опасность (ПО)', hint: 'Число либо дробь: 0, 1/8, 1/4, 1/2, 1…' },
    'combat.speed': { name: 'Скорость текстом', hint: 'Описание особых условий движения. Числовые скорости задайте ниже.' },
    'combat.speed_opt': { name: 'Способы передвижения', type: 'object_array', rowName: 'Передвижение', fields: [{ key: 'name', name: 'Способ', type: 'text', placeholder: 'Ходьба, полёт, плавание…' }, { key: 'value', name: 'Скорость, фт.', type: 'int', min: 0 }] },
    feats: { rowName: 'Особенность' }, actions: { rowName: 'Действие' }, reactions: { rowName: 'Реакция' },
  },
  11: {
    feature: { name: 'Название особенности' }, feature_desc: { name: 'Как работает особенность' },
    'item_choices.key': { createKey: true }, item_choices: { rowName: 'Выбор снаряжения' },
    'item_choices.option_item_ids': { name: 'Варианты снаряжения', type: 'item_array', item_type: 2 },
    'item_choices.replace_tool_prof_id': { name: 'Заменяет владение', type: 'suggest', suggest_id: 5 },
    'item_choices.replace_tool_item_id': { name: 'Заменяет инструмент', type: 'item', item_type: 14 },
    'item_choices.replace_equipment_item_id': { name: 'Заменяет предмет', type: 'item', item_type: 2 },
  },
  15: { polarity: { name: 'Влияние на персонажа' }, stacking: { name: 'Повторное наложение' }, thesis: { name: 'Короткие тезисы', hint: 'Каждое правило — с новой строки. Они появятся в краткой карточке эффекта.' }, code: { name: 'Ключ эффекта', createKey: true }, level: { name: 'Начальная ступень', min: 1 }, max_level: { name: 'Максимальная ступень', min: 1 } },
}

export function catalogueField(field, typeId, path) {
  const simplePath = path.replace(/^variants\./, '')
  let result = { ...field, ...common[simplePath], ...byType[typeId]?.[path] }
  if (/(attacks|dices|addon)\.(count|dice_id|type|bonus)$/.test(path)) result = { ...result, ...rollFields[field.key] }
  if (/^(contents|tool_items|equipment_items)\.item_id$/.test(path)) result = { ...result, name: 'Предмет', type: 'item', item_type: path.startsWith('tool_items') ? 14 : 2 }
  if (path.endsWith('.params')) result.optional = true
  if (path === 'variants.value') result.createKey = true
  if (typeId === 7 && path === 'asi_choice.choice_key') result = { ...result, createKey: true, hint: 'Автоматический ключ самостоятельного выбора характеристики.' }
  if (path === 'variants') result.rowName = 'Вариант расы'
  if (/^spellcasting\.(known_progression|unrestricted_progression)\.level$/.test(path)) result = { ...result, name: 'С уровня класса', min: 1, max: 20 }
  if (/^spellcasting\.(known_progression|unrestricted_progression)\.(cantrips|spells|count)$/.test(path)) result.min = 0
  if (['stats', 'saving_throws'].includes(path.split('.')[0]) && path.includes('.')) result.hint = path.startsWith('stats.') ? 'Значение характеристики существа, не модификатор.' : 'Полный бонус спасброска. Пусто — использовать модификатор характеристики.'
  if (!result.hint) result.hint = result.type === 'item' ? 'Выберите связанную запись по названию.' : `Настройка «${result.name}». Необязательное значение можно оставить пустым.`
  return result
}

export function catalogueFieldVisible(field, data, typeId, path, root = data) {
  if (path === 'identity.source') return false
  if (path === 'spellcasting.progression') return false
  if (typeId === 1 && ['range_min', 'range_max'].includes(path)) return !!data.is_long_range || (data.tags || []).some(tag => [1, 4, 6, 11].includes(Number(tag))) || data.range_min != null || data.range_max != null
  if (!isFieldVisible(field, data)) return false
  if (path === 'armor.ac' || path === 'armor.use_dex') return !data.shield
  if (typeId === 12 && path === 'armor.shield' && root.category && !!data.shield === (root.category === 'shield')) return false
  if (path === 'armor.shield_bonus') return !!data.shield
  if (path === 'armor.dex_cap') return !data.shield && !!data.use_dex
  if (path === 'duration.value') return ['rounds', 'minutes', 'hours'].includes(data.kind)
  if (typeId === 5 && path === 'damage.save_effect') return !!data.save_ability
  if (typeId === 5 && /^(damage|heal)\.(addon|addon_instances)$/.test(path)) return ['slot', 'cantrip'].includes(data.scaling)
  if (typeId === 13) {
    if (['movement', 'capacity', 'propulsion'].includes(path)) return root.category !== 'tack'
    if (path === 'vehicle_stats') return !['mount', 'tack'].includes(root.category)
    if (path === 'capacity.carrying_lb') return root.category === 'mount' || data.carrying_lb != null
    if (['capacity.crew', 'capacity.passengers', 'capacity.cargo_lb', 'capacity.cargo_tons'].includes(path)) return root.category !== 'mount'
    if (['rider_stability_advantage', 'for_exotic_mount'].includes(path)) return root.category === 'tack'
  }
  if (path === 'spellcasting.level_up_choices') return data.selection_mode === 'spellbook'
  if (path === 'spellcasting.prepares') return data.selection_mode === 'spellbook' || !data.selection_mode
  if (typeId === 11 && path.startsWith('item_choices.replace_')) return !!data[({ replace_tool_prof_id: 'grants_tool_proficiency', replace_tool_item_id: 'grants_tool_item', replace_equipment_item_id: 'grants_equipment_item' })[field.key]]
  return true
}

export function updateCatalogueValue(data, field, value, path, typeId) {
  const next = { ...data, [field.key]: value }
  if (path === 'armor.shield') for (const key of value ? ['ac', 'use_dex', 'dex_cap'] : ['shield_bonus']) delete next[key]
  if (path === 'armor.use_dex' && !value) delete next.dex_cap
  if (path === 'duration.kind' && !['rounds', 'minutes', 'hours'].includes(value)) delete next.value
  if (path === 'damage.save_ability' && !value) delete next.save_effect
  if (['damage.scaling', 'heal.scaling'].includes(path) && !['slot', 'cantrip'].includes(value)) { delete next.addon; delete next.addon_instances }
  if (path === 'spellcasting.selection_mode') { next.prepares = value !== 'known'; if (value !== 'spellbook') delete next.level_up_choices }
  if (path === 'caster_progression' && next.spellcasting) { next.spellcasting = { ...next.spellcasting }; delete next.spellcasting.progression }
  if (typeId === 12 && path === 'category' && value !== data.category) {
    const armor = { ...data.armor, shield: value === 'shield' }
    if (armor.shield) { armor.shield_bonus ??= 2; for (const key of ['ac', 'use_dex', 'dex_cap']) delete armor[key] }
    else { delete armor.shield_bonus; armor.use_dex = value !== 'heavy'; if (value === 'medium') armor.dex_cap = 2; else delete armor.dex_cap }
    next.armor = armor
  }
  return next
}
