import { computed, ref } from 'vue'
import { defaultSlots } from '@/features/character-editor/blocks/dnd/lib/spellEntry'

export const SPELL_SLOT_RESTS = ['long_rest', 'short_rest']

function normalizedSlots(saved) {
  const list = defaultSlots()
  for (const slot of (Array.isArray(saved) ? saved : [])) {
    const entry = list.find((candidate) => candidate.level === Number(slot?.level))
    if (!entry) continue
    entry.total = Math.max(0, Math.min(9, Number(slot.total) || 0))
    entry.used = Math.max(0, Math.min(entry.total, Number(slot.used) || 0))
  }
  return list
}

function mergeLegacyPact(slots, pactSlot) {
  if (!pactSlot || Number(pactSlot.total) <= 0) return slots
  const target = slots.find((slot) => slot.level === Number(pactSlot.level))
  if (!target) return slots
  target.total = Math.min(9, target.total + (Number(pactSlot.total) || 0))
  target.used = Math.min(target.total, target.used + (Number(pactSlot.used) || 0))
  return slots
}

export function useSpellSlots({ canInteract, emitChange }) {
  const slotPools = ref({
    long_rest: defaultSlots(),
    short_rest: defaultSlots(),
  })

  const activeSlotPools = computed(() => SPELL_SLOT_RESTS.map((rest) => ({
    rest,
    slots: slotPools.value[rest].filter((slot) => slot.total > 0),
  })).filter((pool) => pool.slots.length > 0))

  function loadSlotPools(saved = {}) {
    const canonical = saved?.slot_pools && typeof saved.slot_pools === 'object' ? saved.slot_pools : null
    if (canonical) {
      slotPools.value = {
        long_rest: normalizedSlots(canonical.long_rest),
        short_rest: normalizedSlots(canonical.short_rest),
      }
      return
    }

    const legacyRest = saved?.slots_rest === 'short_rest' ? 'short_rest' : 'long_rest'
    const next = { long_rest: defaultSlots(), short_rest: defaultSlots() }
    next[legacyRest] = normalizedSlots(saved?.slots)
    next.short_rest = mergeLegacyPact(next.short_rest, saved?.pact_slots)
    slotPools.value = next
  }

  function serializedSlotPools() {
    return Object.fromEntries(SPELL_SLOT_RESTS.map((rest) => [rest, slotPools.value[rest]
      .filter((slot) => slot.total > 0)
      .map((slot) => ({ level: slot.level, total: slot.total, used: slot.used }))]))
  }

  function slotAt(rest, level) {
    return slotPools.value[rest]?.find((slot) => slot.level === Number(level)) || null
  }

  function toggleSlot(rest, level, index) {
    if (!canInteract.value) return
    const slot = slotAt(rest, level)
    if (!slot || index > slot.total) return
    slot.used = index <= slot.used ? index - 1 : index
    emitChange()
  }

  function setTotal(rest, level, total) {
    const slot = slotAt(rest, level)
    if (!slot) return
    slot.total = Math.max(0, Math.min(9, Number(total) || 0))
    if (slot.used > slot.total) slot.used = slot.total
    emitChange()
  }

  function replaceTotals(rest, totals) {
    const list = slotPools.value[rest]
    if (!list) return false
    let changed = false
    list.forEach((slot, index) => {
      const total = Math.max(0, Math.min(9, Number(totals?.[index]) || 0))
      const used = Math.min(slot.used, total)
      if (slot.total !== total || slot.used !== used) changed = true
      slot.total = total
      slot.used = used
    })
    return changed
  }

  function adjustSlotUsed(rest, level, delta) {
    if (!canInteract.value) return
    const slot = slotAt(rest, level)
    if (!slot) return
    slot.used = Math.max(0, Math.min(slot.total, slot.used + delta))
    emitChange()
  }

  return {
    slotPools,
    activeSlotPools,
    loadSlotPools,
    serializedSlotPools,
    toggleSlot,
    setTotal,
    replaceTotals,
    adjustSlotUsed,
  }
}
