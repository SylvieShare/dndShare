import { computed } from 'vue'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { spellRollOptions } from '../lib/spellRollOptions'

export const spellRollLabel = option => option.kind === 'save' ? `Спасбросок: ${option.label}`
  : option.primary ? option.kind === 'heal' ? 'Бросить на лечение' : 'Бросить на урон' : `Бросить: ${option.label}`

export function useSpellRollOptions(entry) {
  const events = useSessionEventsStore()
  const hasSequence = computed(() => !!events.sessionUuid && !!(entry.value.item?.data?.damage?.roll_table || entry.value.item?.data?.damage?.attack_chain))
  const hasAttack = computed(() => !!entry.value.item?.data?.damage?.range_attack)
  const options = computed(() => spellRollOptions(entry.value).filter(option =>
    !(hasSequence.value && option.primary && option.kind === 'damage')
    && !(option.primary && option.kind === 'heal' && (entry.value.item?.data?.heal?.apply !== false || entry.value.item?.data?.item_creation?.length))))
  return { hasSequence, hasAttack, options }
}
