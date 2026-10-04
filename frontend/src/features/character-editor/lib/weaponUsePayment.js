import { unref } from 'vue'
import { logResourceChange } from './sessionEventData'
import { spendDamageResources } from './weaponDamageResources'

/** Pay the use and any selected extras together, preserving the pending steps. */
export function payWeaponUse(charCtx, plan, actions = [], keys = [], amounts = {}) {
  if (plan.error) return plan.error
  const values = unref(charCtx.values) || {}
  const items = unref(charCtx.characterResources?.itemsById) || new Map()
  const extra = spendDamageResources({ ...values, ...plan.patch }, items, actions, keys, !!charCtx.ownerMode, amounts)
  if (extra.error) return extra.error
  charCtx.updateValues({ ...plan.patch, ...extra.patch })
  if (plan.resource) logResourceChange(charCtx, plan.resource, plan.resource.value - plan.event.resource_cost)
  for (const { resource, cost } of extra.costs) logResourceChange(charCtx, resource, resource.value - cost)
  return ''
}
