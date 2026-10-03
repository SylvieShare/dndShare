const poolKey = resource => String(resource.source?.resourceKey || '')
const usesCharges = rule => !!rule.uses_resource || !!rule.resource_key || Number(rule.resource_cost) > 0

// One visible counter per pool. Explicit links and existing mechanics own it.
export function weaponBlockResources(item, resources = []) {
  const data = item?.data || {}, remaining = new Map(resources.map(resource => [poolKey(resource), resource]))
  const result = { confirmed: {}, notes: {}, uses: {}, effects: [], damage: [], actions: [], unassigned: [] }
  function take(key = '') {
    const resource = remaining.get(String(key))
    if (!resource) return []
    remaining.delete(String(key))
    return [resource]
  }
  for (const rule of data.confirmed_uses || []) result.confirmed[rule.key] = take(rule.resource_key)
  for (const rule of data.weapon_uses || []) if (usesCharges(rule)) result.uses[rule.key] = take(rule.resource_key)
  for (const note of data.weapon_notes || []) if (Object.hasOwn(note, 'resource_key')) result.notes[note.key] = take(note.resource_key)
  for (const link of data.status_effects || []) {
    const action = (data.feature_actions || []).find(rule => rule.key === link.key && usesCharges(rule))
    const damage = (data.weapon_damage || []).find(rule => rule.key === link.weapon_damage_key && usesCharges(rule))
    if (action || damage) result.effects.push(...take((action || damage).resource_key))
  }
  if (data.status_effects?.length) result.effects.push(...take(''))
  for (const rule of data.weapon_damage || []) if (usesCharges(rule)) {
    const linked = take(rule.resource_key)
    if (linked.length) result.damage.push({ ...rule, resources: linked })
  }
  for (const rule of data.feature_actions || []) if (usesCharges(rule)) {
    const linked = take(rule.resource_key)
    if (linked.length) result.actions.push({ ...rule, resources: linked })
  }
  result.unassigned = [...remaining.values()]
  return result
}
