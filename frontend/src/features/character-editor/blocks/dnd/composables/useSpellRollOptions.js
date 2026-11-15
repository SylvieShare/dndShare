import { computed } from 'vue'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { spellRollOptions } from '../lib/spellRollOptions'
import { hasSpellSequence } from '../lib/spellSequence'

export const spellRollLabel = option => option.kind === 'save' ? `Спасбросок: ${option.label}`
  : option.primary ? option.kind === 'heal' ? 'Бросить на лечение' : 'Бросить на урон' : `Бросить: ${option.label}`

export function useSpellRollOptions(entry) {
  const events = useSessionEventsStore()
  const hasSequence = computed(() => !!events.sessionUuid && hasSpellSequence(entry.value.item))
  const hasAttack = computed(() => !!entry.value.item?.data?.damage?.range_attack)
  const options = computed(() => spellRollOptions(entry.value).filter(option =>
    !(hasSequence.value && option.primary && option.kind === 'damage')
    && !(option.primary && option.kind === 'heal' && (entry.value.item?.data?.heal?.apply !== false || entry.value.item?.data?.item_creation?.length))))
  return { hasSequence, hasAttack, options }
}
