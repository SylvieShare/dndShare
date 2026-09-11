import { computed, nextTick, ref, unref } from 'vue'
import { useDiceStore } from '@/stores/dice'
import { inventoryEntries } from '@/features/character-editor/lib/characterMagicItems'
import { lastChargeRuleError, resolveLastCharge, undoLastCharge } from '@/features/character-editor/lib/itemLastCharge'

export function useLastChargeCheck(charCtx, uid) {
  const dice = useDiceStore(), busy = ref(false)
  const values = () => unref(charCtx.values) || {}
  const entry = computed(() => inventoryEntries(values()).find(row => row.entry.uid === unref(uid))?.entry)
  const check = computed(() => entry.value?.params?.magic?.last_charge_check)
  async function roll() {
    const current = check.value
    if (!charCtx.ownerMode || busy.value || current?.status !== 'pending' || lastChargeRuleError(current.rule)) return
    busy.value = true
    try {
      const result = dice.roll(`Последний заряд: ${current.source_name}`, current.rule.dice, { log: false })
      const patch = resolveLastCharge(values(), unref(uid), current.id, result.total)
      if (!Object.keys(patch).length) return
      charCtx.updateValues(patch)
      charCtx.logSessionEvent?.({ type: 'dice_roll', action: `Последний заряд · ${current.source_name}: ${result.total <= Number(current.rule.failure_max) ? 'магия утрачена' : 'магия сохранена'}`,
        data: { checkId: current.id, instanceUid: unref(uid), result } })
      await nextTick()
    } finally { busy.value = false }
  }
  function undo(checkId) {
    if (!charCtx.ownerMode || busy.value) return
    const patch = undoLastCharge(values(), unref(uid), checkId)
    if (!Object.keys(patch).length) return
    charCtx.updateValues(patch)
    charCtx.logSessionEvent?.({ type: 'feature_state', action: 'Отменена проверка последнего заряда', data: { checkId, instanceUid: unref(uid) } })
  }
  return { entry, check, busy, roll, undo }
}
