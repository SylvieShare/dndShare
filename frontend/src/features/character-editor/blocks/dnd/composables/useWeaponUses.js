import { instanceEventData, resourceChangeData } from '@/features/character-editor/lib/sessionEventData'
import { nextTick, ref, unref } from 'vue'
import { useSuggestStore } from '@/stores/suggest'
import { useDiceStore } from '@/stores/dice'
import { availableWeaponUses, completeWeaponUseStep, startWeaponUse, updateWeaponUse, weaponUseState } from '@/features/character-editor/lib/weaponUses'
import { payWeaponUse } from '@/features/character-editor/lib/weaponUsePayment'

/** The weapon block supplies its normal attack and damage calculations. */
export function useWeaponUses(charCtx, calculation) {
  const busy = ref(false), error = ref(''), suggest = useSuggestStore()
  const values = () => unref(charCtx.values) || {}
  const items = () => unref(charCtx.characterResources?.itemsById) || new Map()
  const choices = entry => availableWeaponUses(values(), items(), entry.uid, !!charCtx.ownerMode)
  function plan(entry, key) {
    const rule = choices(entry).find(row => row.key === key)
    if (!rule || rule.error) return { error: rule?.error || 'Применение недоступно.', patch: {} }
    return { ...startWeaponUse(values(), items(), entry.uid, key, calculation.prepare(entry, rule), suggest.items(12), !!charCtx.ownerMode), resource: rule.resource }
  }
  const dice = useDiceStore()
  async function rollStep(entry, key, stepKey) {
    if (busy.value || !charCtx.ownerMode) return
    let event = weaponUseState(values(), entry.uid)
    const prepared = event?.status === 'active' ? null : plan(entry, key)
    if (prepared?.error) { error.value = prepared.error; return }
    event = prepared?.event || event
    const step = event?.key === key && event.steps.find(row => row.key === stepKey)
    if (step?.kind !== 'damage' || step.status !== 'pending') return
    busy.value = true
    try {
      error.value = prepared ? payWeaponUse(charCtx, prepared) : ''
      if (error.value) return
      const result = dice.roll(`${event.title}: ${step.title}`, step.expression, { log: false })
      charCtx.updateValues(completeWeaponUseStep(values(), entry.uid, event.id, stepKey, result))
      charCtx.logSessionEvent?.({ type: 'dice_roll', action: `${event.title}: ${step.title}`, data: {
        ...instanceEventData(charCtx, entry.uid), result, damageRoll: true, weaponUseId: event.id, stepKey,
        ...(step.save ? { savingThrow: { ability: step.save.ability, dc: step.save.dc, onSuccess: step.save.half ? 'half' : 'none', results: [] } } : {}),
      } })
      await nextTick()
      return result
    } finally { busy.value = false }
  }
  async function start(entry, key, attackRollMode = 'auto', excludedBonuses = []) {
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
        charCtx.logSessionEvent?.({ type: 'dice_roll', action: `Переброс атаки: ${rule.title}`, data: { ...instanceEventData(charCtx, entry.uid), result, attackRoll: true, weaponUseId: plan.event.id } })
      }
      const result = await calculation.attack(prepared.entry, `${rule.title}: ${calculation.title(entry)}`, false, onReroll, attackRollMode, excludedBonuses)
      if (!result) return
      plan.event.attack_result = result
      plan.event.critical = isCritical(result)
      charCtx.updateValues(plan.patch)
      charCtx.logSessionEvent?.({ type: 'dice_roll', action: `${rule.title}: ${calculation.title(entry)}`,
        data: { ...(rule.resource && plan.event.resource_cost ? resourceChangeData(rule.resource, rule.resource.value - plan.event.resource_cost) : {}), ...instanceEventData(charCtx, entry.uid), result, attackRoll: true, weaponUseId: plan.event.id, resourceSpent: plan.event.resource_cost } })
      await nextTick()
    } finally { busy.value = false }
  }
  return { choices, plan, start, rollStep, error }
}
