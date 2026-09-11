import { inventoryEntries, magicItemActive, mapOwnedEntries } from './characterMagicItems'

export function selectedTargetRuleError(rule) {
  if (!rule || !String(rule.title || '').trim()) return 'Укажите название выбранной цели.'
  for (const key of ['duration_dawns', 'cooldown_dawns']) {
    const n = Number(rule[key])
    if (!Number.isInteger(n) || n < (key === 'duration_dawns' ? 1 : 0) || n > 100) return 'Укажите срок в рассветах: длительность 1–100, ожидание 0–100.'
  }
  if (rule.damage && (!/^d(4|6|8|10|12|20|100)$/.test(rule.damage.dice) || !Number.isInteger(Number(rule.damage.dice_count)) || Number(rule.damage.dice_count) < 1 || Number(rule.damage.dice_count) > 100 || rule.damage.damage_type == null)) return 'Укажите кость, количество и тип дополнительного урона.'
  return ''
}

/** The target belongs to this source instance, never to a character-wide enemy slot. */
export function selectedTargets(values, items) {
  return inventoryEntries(values).flatMap(({ entry, equipped }) => {
    const item = items.get(String(entry.magic_item_id ?? entry.item_id)), rule = item?.data?.selected_target
    if (!entry.uid || !rule || selectedTargetRuleError(rule)) return []
    const state = entry.params?.magic?.selected_target
    const attuned = magicItemActive(item, entry, true, values)
    return [{ uid: entry.uid, item, rule, state, active: attuned && equipped,
      penaltyActive: attuned && state?.status === 'active',
      available: !state || ['expired', 'ready'].includes(state.status) }]
  })
}

function patchTarget(values, uid, state) {
  return mapOwnedEntries(values, entry => entry.uid === uid
    ? { ...entry, params: { ...entry.params, magic: { ...entry.params?.magic, selected_target: state } } } : entry)
}

export function changeSelectedTarget(values, items, uid, operation, payload, owner = false) {
  if (!owner) return {}
  const source = selectedTargets(values, items).find(row => row.uid === uid)
  if (!source) return {}
  const { rule, state } = source
  if (operation === 'declare') {
    const name = String(payload || '').trim()
    if (!source.active || !source.available || !name || name.length > 120) return {}
    return patchTarget(values, uid, { id: crypto.randomUUID(), name, status: 'active', selected: true,
      dawns_left: Number(rule.duration_dawns), cooldown_dawns: Number(rule.cooldown_dawns) })
  }
  if (!state || payload?.id !== state.id) return {}
  if (operation === 'select' && source.active && state.status === 'active') return patchTarget(values, uid, { ...state, selected: !!payload.selected })
  if (operation === 'defeat' && state.status === 'active') return patchTarget(values, uid, { ...state, status: state.cooldown_dawns ? 'defeated' : 'ready', selected: false, dawns_left: state.cooldown_dawns })
  // Explicit correction is confirmed by the UI, not a normal way to replace a living enemy.
  if (operation === 'correct') return patchTarget(values, uid, null)
  return {}
}

export function selectedTargetDawnCandidates(values, items) {
  return selectedTargets(values, items).filter(row => ['active', 'defeated'].includes(row.state?.status))
}

export function advanceSelectedTargets(values, items) {
  const candidates = selectedTargetDawnCandidates(values, items), results = []
  if (!candidates.length) return { patch: {}, results }
  const states = new Map(candidates.map(({ uid, item, state }) => {
    const left = Math.max(0, Number(state.dawns_left) - 1)
    const status = left ? state.status : state.status === 'defeated' ? 'ready' : 'expired'
    results.push({ uid, title: `${item.name}: ${state.name}`, before: state.dawns_left, after: left, status })
    return [uid, { ...state, dawns_left: left, status, selected: left > 0 && state.selected }]
  }))
  return { results, patch: mapOwnedEntries(values, entry => states.has(entry.uid)
    ? { ...entry, params: { ...entry.params, magic: { ...entry.params?.magic, selected_target: states.get(entry.uid) } } } : entry) }
}

export function selectedTargetDamageRules(values, items) {
  return selectedTargets(values, items).flatMap(({ uid, item, rule, state, active }) => {
    if (!active || state?.status !== 'active') return []
    return [{ ...rule.damage, key: `target:${uid}:${state.id}`, label: `По выбранной цели: ${state.name}`,
      source_label: item.name, owner_level: 1, weapon_uid: uid, weapon_kind: rule.ranged_only ? 'ranged' : undefined,
      target_choice: { uid, id: state.id, selected: !!state.selected },
      double_on_critical: true, condition: rule.condition || '',
      attack_condition: [rule.attack_advantage && 'Преимущество', rule.ignore_partial_cover && 'Игнорирует укрытие, кроме полного', rule.ignore_long_range && 'Без помехи от дальней дистанции'].filter(Boolean).join(' · ') }]
  })
}

export function selectedTargetRollRules(values, items) {
  return selectedTargets(values, items).flatMap(({ uid, item, rule, state, active, penaltyActive }) => {
    const rows = [], common = { kind: 'roll_mode', scopes: ['attack'], weapon_attacks_only: true, source_label: `${item.name}: ${state?.name || rule.title}` }
    if (active && state?.status === 'active' && state.selected && rule.attack_advantage) rows.push({ ...common,
      key: `target:${uid}:advantage`, weapon_uid: uid, weapon_kind: rule.ranged_only ? 'ranged' : undefined,
      forbid_improvised: true, mode: 'advantage' })
    if (penaltyActive && rule.other_weapons_disadvantage) rows.push({ ...common,
      key: `target:${uid}:other-weapons`, excluded_weapon_uid: uid, mode: 'disadvantage' })
    return rows
  })
}
