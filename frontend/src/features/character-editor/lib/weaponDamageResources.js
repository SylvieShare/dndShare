import { selectedDamageActions } from '@/shared/lib/weaponDamageOptions'
import { collectCharacterResources, setCharacterResourceAvailable } from './characterResources'

export function bindDamageResources(actions, resources, canSpend = true) {
  return actions.map(action => {
    if (!action.uses_resource && !action.resource_key) return action
    const resource = resources.find(row => row.source?.valueId === action.resource_owner?.valueId
      && row.source?.entryKey === action.resource_owner?.entryKey
      && (row.source?.resourceKey || '') === (action.resource_key || ''))
    const cost = Number(action.resource_cost ?? 1)
    return { ...action, resource, resource_cost: cost,
      resource_error: !Number.isInteger(cost) || cost < 1 ? 'Стоимость ресурса должна быть целым положительным числом.' : !canSpend ? 'Расходовать ресурс может владелец персонажа.' : !resource ? 'Ресурс недоступен.' : '' }
  })
}

/** Group costs before checking balance: several extras can draw from the same pool. */
export function damageResourceCosts(actions, keys) {
  const costs = new Map()
  for (const action of selectedDamageActions(actions, keys)) {
    if (!action.uses_resource && !action.resource_key) continue
    if (action.resource_error || !action.resource) return { error: action.resource_error || 'Ресурс недоступен.', costs: [] }
    const key = action.resource.key
    const row = costs.get(key) || { resource: action.resource, cost: 0 }
    row.cost += Math.max(1, Number(action.resource_cost) || 1)
    costs.set(key, row)
  }
  const rows = [...costs.values()]
  const missing = rows.find(row => Number(row.resource.value) < row.cost)
  return { costs: rows, error: missing ? `Недостаточно ресурса «${missing.resource.title}»: нужно ${missing.cost}, доступно ${missing.resource.value}.` : '' }
}

/** Re-read current balances and build one document update, before launching the roll. */
export function spendDamageResources(values, itemsById, actions, keys, canSpend = true) {
  const current = bindDamageResources(actions, collectCharacterResources(values, itemsById), canSpend)
  const plan = damageResourceCosts(current, keys)
  if (plan.error) return { error: plan.error, patch: {} }
  let next = values
  const patch = {}
  for (const { resource, cost } of plan.costs) {
    const update = setCharacterResourceAvailable(next, itemsById, resource.key, resource.value - cost)
    Object.assign(patch, update)
    next = { ...next, ...update }
  }
  return { patch, error: '', costs: plan.costs }
}
