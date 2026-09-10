import { defaultDataForFields } from '@/features/handbook/objects/lib/schemaFields'

export const RESOURCE_KEYS = [
  'max_use', 'resource_color', 'manual_size', 'max_use_stat', 'max_use_min',
  'max_use_stat_multiplier', 'max_use_bonus', 'max_use_level_multiplier', 'max_use_scaling',
  'rollback_short_rest', 'rollback_long_rest', 'rollback_short_rest_level',
  'short_rest_recovery', 'short_rest_recovery_level',
]
const BASIC_KEYS = ['desc', 'level']
const BINDING_KEYS = ['race_ids', 'subrace_ids', 'class_ids', 'subclass_ids']
const BLOCK_ORDER = ['granted_spells', 'resources', 'choices', 'feature_actions', 'status_effects',
  'weapon_damage', 'progression', 'sheet_widgets', 'defenses', 'derived_effects', 'prereq', 'usage']

export const BLOCK_HINTS = {
  granted_spells: 'Заклинания, которые способность добавляет персонажу, и правила их сотворения.',
  resources: 'Количество использований способности и восстановление после отдыха.',
  choices: 'Предложите игроку выбрать заклинание, навык или другой вариант при получении способности.',
  feature_actions: 'Действия, доступные на листе: активация, расход ресурса или применение эффекта.',
  status_effects: 'Временные эффекты, которые можно включить через эту способность.',
  defenses: 'Сопротивления, невосприимчивости или уязвимости к выбранным типам урона.',
  derived_effects: 'Автоматические изменения КД, скорости, владений и бросков персонажа.',
  prereq: 'Условия, которые персонаж должен выполнить для получения способности.',
  usage: 'Ограничения использования, например требования к надетой броне.',
  scaling: 'Как значения и число использований меняются с уровнем персонажа или связанного класса.',
  display_scaling: 'Короткая подпись рядом с названием способности для каждого уровня.',
  hp_bonuses: 'Постоянная прибавка к максимуму хитов или прибавка за каждый уровень.',
  passive_effects: 'Памятки о постоянно действующих свойствах на листе персонажа.',
  roll_triggers: 'Предложения после результата броска, например переброс натуральной единицы.',
  roll_adjustments: 'Правила изменения результата броска, например минимальное значение на кости.',
  critical_damage: 'Дополнительные кости оружия при критическом попадании.',
  weapon_damage: 'Дополнительный урон и условия его применения к оружию.',
  sheet_widgets: 'Показатели и переключатели способности на листе персонажа.',
  choice_defenses: 'Защиты, зависящие от сохранённого выбора другой способности.',
}

export function hasFieldValue(value) {
  if (Array.isArray(value)) return value.length > 0
  if (value && typeof value === 'object') return Object.values(value).some(hasFieldValue)
  return value !== undefined && value !== null && value !== '' && value !== false
}

const DEPENDENCY_NAMES = {
  feature_actions: 'Действие на листе', granted_spells: 'Дарованное заклинание',
  use_resources: 'Отдельный ресурс', choices: 'Выбор', status_effects: 'Связанный эффект',
  defenses: 'Защита', derived_effects: 'Изменение показателя', scaling: 'Шаг прогрессии',
  display_scaling: 'Подпись по уровню', hp_bonuses: 'Бонус хитов', passive_effects: 'Пассивный эффект',
  roll_triggers: 'Событие броска', roll_adjustments: 'Изменение броска', critical_damage: 'Урон при крите',
  weapon_damage: 'Дополнительный урон оружия', sheet_widgets: 'Панель на листе', choice_defenses: 'Защита по выбору',
}

export function abilityEditorProfile(fields, typeId) {
  const bindings = Number(typeId) === 3 ? BINDING_KEYS.slice(0, 2)
    : Number(typeId) === 4 ? BINDING_KEYS.slice(2) : []
  const primary = fields.filter(field => BASIC_KEYS.includes(field.key) || bindings.includes(field.key))
  const resourceFields = fields.filter(field => RESOURCE_KEYS.includes(field.key))
  const blocks = fields.filter(field => !BASIC_KEYS.includes(field.key)
    && !BINDING_KEYS.includes(field.key) && !RESOURCE_KEYS.includes(field.key) && !['scaling', 'display_scaling'].includes(field.key))
    .map(field => ({ key: field.key, name: DEPENDENCY_NAMES[field.key] || field.name, hint: BLOCK_HINTS[field.key], fields: [field], repeatable: field.type === 'object_array' }))
  const progression = fields.filter(field => ['scaling', 'display_scaling'].includes(field.key))
  if (progression.length) blocks.push({ key: 'progression', name: 'Развитие с уровнем', hint: 'Одна таблица изменений. Значение действует до следующей строки; подпись на листе рассчитывается автоматически.', fields: progression })
  if (resourceFields.length) blocks.push({ key: 'resources', name: 'Ресурс и восстановление', hint: BLOCK_HINTS.resources, fields: resourceFields })
  blocks.sort((a, b) => {
    const rank = key => BLOCK_ORDER.includes(key) ? BLOCK_ORDER.indexOf(key) : BLOCK_ORDER.length
    return rank(a.key) - rank(b.key)
  })
  return { primary, blocks }
}

export function activeAbilityBlocks(blocks, data) {
  return blocks.filter(block => block.fields.some(field => {
    const value = data[field.key]
    // The old form saved these defaults even on abilities without a resource.
    if (block.key === 'resources' && ['max_use_min', 'max_use_stat_multiplier', 'max_use_bonus'].includes(field.key)) {
      return hasFieldValue(value) && value !== field.default
    }
    return hasFieldValue(value)
  })).map(block => block.key)
}

export function addAbilityBlock(block, data) {
  for (const field of block.fields) {
    if (block.key === 'progression') data[field.key] = []
    else if (field.type === 'object_array' && block.fields.length === 1) data[field.key] = [defaultDataForFields(field.fields)]
    else if (field.type === 'object') data[field.key] = defaultDataForFields(field.fields)
    else if (field.default !== undefined) data[field.key] = field.default
  }
}

export function removeAbilityBlock(block, data) {
  for (const field of block.fields) delete data[field.key]
}

const SIMPLE_FIELDS = new Set(['title', 'name', 'description', 'text', 'kind', 'level', 'spell',
  'ability', 'cast_level', 'slotless', 'damage_type', 'value', 'base', 'per_level', 'tone', 'count',
  'key', 'source', 'options', 'from_suggest_id', 'from_item_type_id', 'effect', 'action_type',
  'max_use', 'rollback_short_rest', 'rollback_long_rest', 'resource_color', 'label', 'dice', 'uses', 'note'])
export function advancedAbilityField(field) {
  return !SIMPLE_FIELDS.has(field.key) && !BINDING_KEYS.includes(field.key)
}

export function abilityFieldHint(field) {
  if (field.hint) return field.hint
  if (BLOCK_HINTS[field.key]) return BLOCK_HINTS[field.key]
  const hints = {
    desc: 'Опишите, что даёт способность и как её использовать. Можно вставить броски и ссылки на справочник.',
    level: 'Уровень, начиная с которого действует правило. Для классовой способности учитывается уровень связанного класса.',
    key: 'Уникальное короткое имя внутри способности. На него могут ссылаться другие правила; после выдачи персонажу менять его не следует.',
    spell: 'Выберите заклинание из справочника.',
    effect: 'Выберите эффект, который накладывает способность.',
    cast_level: 'Фиксированный уровень сотворения. Пустое поле использует обычный уровень заклинания.',
    slotless: 'Разрешает сотворение без расхода ячейки заклинания.',
    max_use: 'Фиксированное число использований. Оставьте пустым, если ограничения нет.',
    manual_size: 'Позволяет вручную задавать максимум использований на листе персонажа.',
    max_use_stat: 'Максимум использований вычисляется из модификатора выбранной характеристики.',
    max_use_min: 'Нижняя граница вычисленного количества использований.',
    max_use_stat_multiplier: 'На сколько умножить модификатор характеристики при расчёте ресурса.',
    max_use_bonus: 'Постоянная прибавка к вычисленному максимуму ресурса.',
    max_use_level_multiplier: 'На сколько умножить уровень при расчёте ресурса.',
    max_use_scaling: 'Берёт количество использований из подходящей строки прогрессии.',
    rollback_short_rest: 'Восстанавливает ресурс после короткого отдыха.',
    rollback_long_rest: 'Восстанавливает ресурс после продолжительного отдыха.',
    count: 'Сколько вариантов игрок должен выбрать.',
    source: 'Откуда брать доступные игроку варианты.',
    race_ids: 'Расы, которым доступна эта способность. Пустой список не ограничивает выбор по расе.',
    subrace_ids: 'Подрасы, которым доступна эта способность.',
    class_ids: 'Классы, которым принадлежит способность. Связь также определяет уровень для её прогрессии.',
    subclass_ids: 'Подклассы, которым принадлежит способность.',
    target_ids: 'Идентификаторы целей эффекта. Перечислите через запятую.',
    from_suggest_id: 'Числовой идентификатор словаря вариантов.',
    from_item_type_id: 'Числовой идентификатор коллекции справочника.',
  }
  if (hints[field.key]) return hints[field.key]
  if (field.type === 'text_array') return 'Несколько значений через запятую. Пустое поле означает отсутствие значений.'
  if (field.type === 'object_array') return `Добавьте записи в «${field.name}». Каждая запись задаёт отдельное правило.`
  if (field.type === 'item') return 'Связанная запись справочника. Нажмите, чтобы выбрать или заменить её.'
  if (field.type === 'suggest' || field.type === 'suggest_array') return 'Выберите значение из соответствующего словаря правил.'
  if (field.type === 'bool' || field.type === 'boolean') return `Включите, если для способности применяется правило «${field.name}».`
  if (field.options) return `Выберите вариант: ${field.options.map(option => option.label).join(', ')}.`
  if (field.type === 'int' || field.type === 'float') return `Числовое значение правила «${field.name}». Необязательное поле можно оставить пустым.`
  return `Укажите ${field.name.toLocaleLowerCase('ru')}. Если это правило не используется, оставьте поле пустым.`
}

export function abilityResourceMode(data) {
  if (data.max_use_stat != null) return 'stat'
  if (data.max_use_level_multiplier != null) return 'level'
  if (data.max_use_scaling) return 'scaling'
  if (data.manual_size) return 'manual'
  return 'fixed'
}

export function changeAbilityResourceMode(data, mode) {
  for (const key of ['max_use_stat', 'max_use_level_multiplier', 'max_use_scaling', 'manual_size']) delete data[key]
  if (mode === 'stat') data.max_use_stat = null
  if (mode === 'level') data.max_use_level_multiplier = 1
  if (mode === 'scaling') data.max_use_scaling = true
  if (mode === 'manual') data.manual_size = true
}
