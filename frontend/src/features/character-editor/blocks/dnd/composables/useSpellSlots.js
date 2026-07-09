import { computed, ref } from 'vue'
import { defaultSlots } from '@/features/character-editor/blocks/dnd/lib/spellEntry'

export function useSpellSlots({ canInteract, emitChange }) {
  const localSlots = ref(defaultSlots())

  const activeSlots = computed(() => localSlots.value.filter(s => s.total > 0))

  function loadSlots(saved) {
    const list = defaultSlots()
    for (const slot of saved || []) {
      const entry = list.find(s => s.level === slot.level)
      if (entry) {
        entry.total = Number(slot.total) || 0
        entry.used = Math.max(0, Math.min(entry.total, Number(slot.used) || 0))
      }
    }
    localSlots.value = list
  }

  function serializedSlots() {
    return localSlots.value
      .filter(s => s.total > 0)
      .map(s => ({ level: s.level, total: s.total, used: s.used }))
  }

  function toggleSlot(level, i) {
    if (!canInteract.value) return
    const sl = localSlots.value.find(s => s.level === level)
    if (!sl || i > sl.total) return
    // tap an empty cell (i <= used) -> refill it and any empty cells before it;
    // tap a full cell (i > used) -> spend it and the full cells after it
    sl.used = i <= sl.used ? i - 1 : i
    emitChange()
  }

  function setTotal(level, total) {
    const sl = localSlots.value.find(s => s.level === level)
    if (!sl) return
    sl.total = Math.max(0, Math.min(9, total))
    if (sl.used > sl.total) sl.used = sl.total
    emitChange()
  }

  function adjustSlotUsed(level, delta) {
    if (!canInteract.value) return
    const sl = localSlots.value.find(s => s.level === level)
    if (!sl) return
    sl.used = Math.max(0, Math.min(sl.total, sl.used + delta))
    emitChange()
  }

  return {
    localSlots,
    activeSlots,
    loadSlots,
    serializedSlots,
    toggleSlot,
    setTotal,
    adjustSlotUsed,
  }
}
