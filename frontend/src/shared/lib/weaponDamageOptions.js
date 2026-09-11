import { damageAmountActions, damageUnitsMax } from './weaponDamageAmounts'
import { dieSides } from './systemDice'

/** Structured dice terms feed both the display component and the roll expression. */
export function weaponDamageActionParts(action, critical = false) {
  const multiplier = critical && action?.double_on_critical !== false ? 2 : 1
  const count = Math.max(0, Number(action?.dice_count) || 0) * multiplier
  const die = String(action?.dice || '').trim()
  return count > 0 && die ? [{ count, diceLabel: die, diceSides: dieSides(die) }] : []
}

export function weaponDamageActionFormula(action, critical = false) {
  return weaponDamageActionParts(action, critical).map(part => `${part.count}${part.diceLabel}`).join('+')
}

/** Convert domain rules into display data; the menu does not interpret schema fields. */
export function weaponDamageMenuOptions(actions, keys, critical = false, scope = 'damage', twoHanded = false, amounts = {}) {
  const original = actions
  actions = damageAmountActions(actions, amounts)
  const selected = new Set(selectedDamageActions(actions, keys).map(action => action.key))
  const costs = new Map()
  for (const action of actions) if (selected.has(action.key) && action.resource) {
    costs.set(action.resource.key, (costs.get(action.resource.key) || 0) + (Number(action.resource_cost) || 0))
  }
  const attackKeys = new Set()
  function includeAttackKey(key) {
    if (!key || attackKeys.has(key)) return
    attackKeys.add(key)
    includeAttackKey(actions.find(action => action.key === key)?.requires_damage_key)
  }
  for (const action of actions) if (action.attack_mode === 'thrown' || action.target_choice) includeAttackKey(action.key)
  return actions.filter(action => scope !== 'attack' || attackKeys.has(action.key)).map(action => {
    const raw = original.find(row => row.key === action.key)
    const maxUnits = scope === 'damage' ? damageUnitsMax(raw) : 0
    const unitCost = Number(raw.resource_cost ?? 1)
    const otherCost = (costs.get(action.resource?.key) || 0) - (selected.has(action.key) ? Number(action.resource_cost) || 0 : 0)
    const parent = actions.find(row => row.key === action.requires_damage_key)
    const label = action.label || action.source_label || 'Дополнительный урон'
    const displayRule = action.preview_replacement || action
    const formula = scope === 'attack' ? '' : weaponDamageActionFormula(displayRule, critical)
    const condition = scope === 'attack'
      ? (action.attack_condition || (action.attack_mode === 'thrown' ? 'Дальняя атака с характеристикой оружия.' : 'Условие выбранного способа атаки.'))
      : action.condition || ''
    const blockedByGrip = twoHanded && action.attack_mode === 'thrown'
    const paid = scope === 'damage' && (action.uses_resource || action.resource_key)
    const cost = Math.max(1, Number(action.resource_cost) || 1)
    const resourceError = !paid ? '' : action.resource_error || (!action.resource ? 'Ресурс недоступен.'
      : Number(action.resource.value) < (selected.has(action.key) ? costs.get(action.resource.key) : cost + (costs.get(action.resource.key) || 0))
        ? `Недостаточно ресурса «${action.resource.title}».` : '')
    return {
      key: action.key, label, mode: action.attack_mode === 'thrown',
      units: maxUnits ? { max: maxUnits, value: action.selected_units, color: action.resource?.color_point,
        available: action.resource_error || !action.resource ? 0 : Math.max(0, Math.floor((Number(action.resource.value) - otherCost) / unitCost)) } : null,
      formula: formula ? `${action.preview_replacement ? '' : '+'}${formula.replace('d', 'к')}` : '',
      formulaPrefix: action.preview_replacement ? '→' : '+', formulaVerb: action.preview_replacement ? 'Урон' : 'Добавит',
      damageParts: scope === 'attack' ? [] : weaponDamageActionParts(displayRule, critical),
      condition, checked: selected.has(action.key),
      nested: !!action.requires_damage_key,
      disabled: blockedByGrip || (!!action.requires_damage_key && !selected.has(action.requires_damage_key)) || (!!resourceError && !selected.has(action.key)),
      resourceCost: paid && !maxUnits ? { amount: cost, color: action.resource?.color_point, unavailable: !!resourceError } : null,
      resourceError,
      hint: [blockedByGrip && 'Сначала выключите хват двумя руками.', condition, resourceError, paid && (maxUnits ? `Каждая ячейка расходует ${unitCost} ед. ресурса. Выбрано: ${action.selected_units}.` : `При броске урона расходуется ${cost} ед. ресурса «${action.resource?.title || 'источник недоступен'}».`), parent && `Сначала включите «${parent.label || parent.source_label}».`,
        scope === 'damage' && action.once_per_turn && 'Не чаще одного раза за ход. Ход не отслеживается автоматически.'].filter(Boolean).join(' ') || 'Добавить урон к текущему броску.',
    }
  })
}

/** Dependencies are local to an item in the handbook and namespaced per instance on the sheet. */
export function selectedDamageActions(actions = [], keys = []) {
  const selected = new Set(keys)
  const byKey = new Map(actions.map(action => [action.key, action]))
  function enabled(key, visiting = new Set()) {
    if (!selected.has(key) || visiting.has(key) || !byKey.has(key)) return false
    const parent = byKey.get(key).requires_damage_key
    return !parent || enabled(parent, new Set([...visiting, key]))
  }
  return [...byKey.values()].filter(action => enabled(action.key))
}

export function damageActionDisabled(action, actions, keys) {
  return !!action.requires_damage_key && !selectedDamageActions(actions, keys)
    .some(parent => parent.key === action.requires_damage_key)
}

export function toggleDamageAction(actions, keys, key, value) {
  const next = value ? [...new Set([...keys, key])] : keys.filter(entry => entry !== key)
  return selectedDamageActions(actions, next).map(action => action.key)
}

export function damageAttackMode(actions, keys) {
  return selectedDamageActions(actions, keys).some(action => action.attack_mode === 'thrown') ? 'thrown' : ''
}

export function weaponDamageDependencyError(rules, rule) {
  const visited = new Set([rule.key])
  let key = rule.requires_damage_key
  while (key) {
    if (visited.has(key)) return 'Дополнительный урон: переключатели не должны зависеть сами от себя или образовывать круг.'
    visited.add(key)
    const parent = rules.find(row => row.key === key)
    if (!parent) return 'Дополнительный урон: выберите существующий переключатель этого предмета.'
    key = parent.requires_damage_key
  }
  return ''
}
