import { nextTick, ref, unref } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { availableWeaponUses, startWeaponUse, updateWeaponUse } from '@/features/character-editor/lib/weaponUses'

/** The weapon block supplies its normal attack and damage calculations. */
export function useWeaponUses(charCtx, calculation) {
  const busy = ref(false), error = ref(''), suggest = useSuggestStore()
  const values = () => unref(charCtx.values) || {}
  const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
  const choices = entry => availableWeaponUses(values(), items(), entry.uid, !!charCtx.ownerMode)
  async function start(entry, key) {
    if (busy.value || !charCtx.ownerMode) return
    const rule = choices(entry).find(row => row.key === key)
    if (!rule || rule.error) { error.value = rule?.error || 'Применение недоступно.'; return }
    busy.value = true
    try {
      const prepared = calculation.prepare(entry, rule)
      const plan = startWeaponUse(values(), items(), entry.uid, key, prepared, suggest.items(12), !!charCtx.ownerMode)
      error.value = plan.error
      if (plan.error) return
      const isCritical = result => {
        const d20 = result.parts?.find(part => part.kind === 'dice' && part.sides === 20)
        return d20?.rolls?.[d20.keptIndex ?? 0] >= prepared.critical_threshold
      }
      const onReroll = result => {
        if (!charCtx.ownerMode) return
        const patch = updateWeaponUse(values(), entry.uid, plan.event.id, event => ({ ...event, attack_result: result, critical: isCritical(result) }))
        if (!Object.keys(patch).length) return
        charCtx.updateValues(patch)
        charCtx.logSessionEvent?.({ type: 'dice_roll', action: `Переброс атаки: ${rule.title}`, data: { result, weaponUseId: plan.event.id } })
      }
      const result = calculation.attack(prepared.entry, `${rule.title}: ${calculation.title(entry)}`, false, onReroll)
      plan.event.attack_result = result
      plan.event.critical = isCritical(result)
      charCtx.updateValues(plan.patch)
      charCtx.logSessionEvent?.({ type: 'dice_roll', action: `${rule.title}: ${calculation.title(entry)}`,
        data: { result, weaponUseId: plan.event.id, resourceSpent: plan.event.resource_cost } })
      await nextTick()
    } finally { busy.value = false }
  }
  return { choices, start, error }
}
