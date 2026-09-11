import { computed, nextTick, ref, unref } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { completeWeaponUseStep, finishWeaponUse, weaponUseState } from '@/features/character-editor/lib/weaponUses'
export function useWeaponUseSteps(charCtx, uid) {
  const busy = ref(false), dice = useDiceStore()
  const values = () => unref(charCtx.values) || {}
  const event = computed(() => weaponUseState(values(), unref(uid)))
  async function resolve(key, critical = false, miss = false) {
    const current = event.value, step = current?.steps.find(row => row.key === key)
    if (!charCtx.ownerMode || busy.value || current?.status !== 'active' || step?.status !== 'pending' || (miss && step.kind !== 'weapon_damage')) return
    busy.value = true
    try {
      const expression = critical && step.kind === 'weapon_damage' ? step.critical_expression : step.expression
      const result = miss ? null : dice.roll(`${current.title}: ${step.title}`, expression, { log: false })
      const patch = completeWeaponUseStep(values(), unref(uid), current.id, key, result, critical)
      charCtx.updateValues(patch)
      charCtx.logSessionEvent?.({ type: miss ? 'feature_state' : 'dice_roll', action: `${current.title}: ${miss ? 'промах по цели' : step.title}`,
        data: { result, weaponUseId: current.id, stepKey: key } })
      await nextTick()
    } finally { busy.value = false }
  }
  function finish(id) {
    if (!charCtx.ownerMode || busy.value) return
    const patch = finishWeaponUse(values(), unref(uid), id)
    if (!Object.keys(patch).length) return
    charCtx.updateValues(patch)
    charCtx.logSessionEvent?.({ type: 'feature_state', action: 'Применение оружия завершено', data: { weaponUseId: id } })
  }
  return { event, busy, resolve, finish }
}
