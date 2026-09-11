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
export function weaponDamageMenuOptions(actions, keys, critical = false, scope = 'damage') {
  const selected = new Set(selectedDamageActions(actions, keys).map(action => action.key))
  const attackKeys = new Set()
  function includeAttackKey(key) {
    if (!key || attackKeys.has(key)) return
    attackKeys.add(key)
    includeAttackKey(actions.find(action => action.key === key)?.requires_damage_key)
  }
  for (const action of actions) if (action.attack_mode === 'thrown') includeAttackKey(action.key)
  return actions.filter(action => scope !== 'attack' || attackKeys.has(action.key)).map(action => {
    const parent = actions.find(row => row.key === action.requires_damage_key)
    const label = action.label || action.source_label || 'Дополнительный урон'
    const formula = scope === 'attack' ? '' : weaponDamageActionFormula(action, critical)
    const condition = scope === 'attack'
      ? (action.attack_mode === 'thrown' ? 'Дальняя атака с характеристикой оружия.' : 'Условие выбранного способа атаки.')
      : action.condition || ''
    return {
      key: action.key, label, formula: formula ? `+${formula.replace('d', 'к')}` : '',
      damageParts: scope === 'attack' ? [] : weaponDamageActionParts(action, critical),
      condition, checked: selected.has(action.key),
      nested: !!action.requires_damage_key,
      disabled: !!action.requires_damage_key && !selected.has(action.requires_damage_key),
      hint: [condition, parent && `Сначала включите «${parent.label || parent.source_label}».`,
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
