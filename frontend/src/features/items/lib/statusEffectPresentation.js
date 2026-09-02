import { STAT_FULL, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'

const POLARITIES = {
  positive: { label: 'Положительный', note: 'Усиливает персонажа', tone: 'accent' },
  negative: { label: 'Отрицательный', note: 'Ограничивает персонажа', tone: 'danger' },
  neutral: { label: 'Нейтральный', note: 'Меняет правила состояния', tone: 'neutral' },
}

const EFFECT_TITLES = {
  armor_bonus: 'Класс доспеха',
  speed_bonus: 'Скорость',
  check_bonus: 'Проверки характеристик',
  skill_bonus: 'Проверки навыков',
  save_bonus: 'Спасброски',
  weapon_attack_bonus: 'Атаки оружием',
  weapon_damage_bonus: 'Урон оружием',
  roll_mode: 'Режим броска',
  activity_block: 'Ограничение действий',
}

const SCOPE_LABELS = {
  ability_check: 'проверки характеристик',
  skill_check: 'проверки навыков',
  saving_throw: 'спасброски',
  weapon_attack: 'атаки оружием',
  weapon_damage: 'урон оружием',
  attack: 'броски атаки',
}

const WEAPON_KIND_LABELS = {
  melee: 'рукопашное оружие',
  ranged: 'дальнобойное оружие',
  any: 'любое оружие',
}

function plural(value, one, few, many) {
  const amount = Math.abs(Number(value))
  const mod100 = amount % 100
  const mod10 = amount % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}

function signed(value) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return ''
  return amount > 0 ? `+${amount}` : String(amount)
}

function abilityName(id) {
  const stat = SUGGEST16_TO_STAT[Number(id)]
  return stat ? STAT_FULL[stat] : ''
}

export function statusPolarity(value) {
  return POLARITIES[value] || POLARITIES.neutral
}

export function statusStacking(value) {
  return value === 'multiple' ? 'Несколько экземпляров' : 'Один экземпляр'
}

export function statusDuration(duration = {}) {
  const kind = duration?.kind || 'manual'
  const amount = Number(duration?.value)
  if (kind === 'manual') return 'До ручного снятия'
  if (kind === 'until_rest') return 'До отдыха'
  if (kind === 'permanent') return 'Постоянно'
  if (!Number.isFinite(amount) || amount <= 0) return 'Не указана'
  if (kind === 'rounds') return `${amount} ${plural(amount, 'раунд', 'раунда', 'раундов')}`
  if (kind === 'minutes') return `${amount} ${plural(amount, 'минута', 'минуты', 'минут')}`
  if (kind === 'hours') return `${amount} ${plural(amount, 'час', 'часа', 'часов')}`
  return 'Не указана'
}

export function statusThesisLines(value) {
  return String(value || '')
    .split(/\r?\n/)
    .map(line => line.replace(/^\s*[-–—•]\s*/, '').trim())
    .filter(Boolean)
}

function ruleValue(rule) {
  if (rule.kind === 'roll_mode') {
    return rule.mode === 'advantage' ? 'Преимущество' : rule.mode === 'disadvantage' ? 'Помеха' : 'Особый режим'
  }
  if (rule.kind === 'activity_block') return rule.label || 'Недоступно'
  const modifier = abilityName(rule.ability_modifier)
  if (modifier) return `Модификатор: ${modifier}`
  return signed(rule.value) || 'Зависит от источника'
}

function ruleNotes(rule) {
  const notes = []
  const scopes = (Array.isArray(rule.scopes) ? rule.scopes : []).map(scope => SCOPE_LABELS[scope]).filter(Boolean)
  const abilities = (Array.isArray(rule.ability_ids) ? rule.ability_ids : []).map(abilityName).filter(Boolean)
  if (scopes.length) notes.push(scopes.join(', '))
  if (abilities.length) notes.push(abilities.join(', '))
  if (WEAPON_KIND_LABELS[rule.weapon_kind] && rule.weapon_kind !== 'any') notes.push(WEAPON_KIND_LABELS[rule.weapon_kind])
  if (rule.minimum != null) notes.push(`минимум ${signed(rule.minimum)}`)
  if (rule.target_parameter) notes.push('только выбранная цель')
  if (rule.label && rule.kind !== 'activity_block') notes.push(rule.label)
  return notes.join(' · ')
}

export function statusRulePresentation(rule = {}) {
  return {
    title: EFFECT_TITLES[rule.kind] || 'Механический эффект',
    value: ruleValue(rule),
    note: ruleNotes(rule),
  }
}

export function statusMechanicsLabel(data = {}) {
  const rules = Array.isArray(data.derived_effects) ? data.derived_effects.length : 0
  const defenses = Array.isArray(data.defenses) ? data.defenses.length : 0
  const total = rules + defenses
  if (!total) return 'Описательный эффект'
  return `${total} ${plural(total, 'правило', 'правила', 'правил')}`
}
