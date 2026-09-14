import { computed, ref } from 'vue'
import { defaultSlots } from '@/features/character-editor/blocks/dnd/lib/spellEntry'

export const SPELL_SLOT_RESTS = ['long_rest', 'short_rest']

function normalizedSlots(saved) {
  const list = defaultSlots()
  for (const slot of (Array.isArray(saved) ? saved : [])) {
    const entry = list.find((candidate) => candidate.level === Number(slot?.level))
    if (!entry) continue
    entry.total = Math.max(0, Math.trunc(Number(slot.total) || 0))
    entry.used = Math.max(0, Math.min(entry.total, Number(slot.used) || 0))
  }
  return list
}

export function useSpellSlots({ canInteract, emitChange, logSessionEvent }) {
  const slotPools = ref({
    long_rest: defaultSlots(),
    short_rest: defaultSlots(),
  })

  const activeSlotPools = computed(() => SPELL_SLOT_RESTS.map((rest) => ({
    rest,
    slots: slotPools.value[rest].filter((slot) => slot.total > 0),
  })).filter((pool) => pool.slots.length > 0))

  function loadSlotPools(saved = {}) {
    const pools = saved?.slot_pools && typeof saved.slot_pools === 'object' ? saved.slot_pools : {}
    slotPools.value = {
      long_rest: normalizedSlots(pools.long_rest),
      short_rest: normalizedSlots(pools.short_rest),
    }
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
    if (!slot || !Number.isInteger(index) || index < 1 || index > slot.total) return
    adjustSlotUsed(rest, level, (index <= slot.used ? index - 1 : index) - slot.used)
  }

  function setTotal(rest, level, total) {
    const slot = slotAt(rest, level)
    if (!slot) return
    slot.total = Math.max(0, Math.trunc(Number(total) || 0))
    if (slot.used > slot.total) slot.used = slot.total
    emitChange()
  }

  function adjustSlotUsed(rest, level, delta, { log = true } = {}) {
    if (!canInteract.value) return
    const slot = slotAt(rest, level)
    if (!slot) return
    const before = slot.used
    slot.used = Math.max(0, Math.min(slot.total, slot.used + delta))
    if (before === slot.used) return
    if (log) logSessionEvent?.({ type: 'spell_slot_changed', action: slot.used > before ? 'Использование ячеек' : 'Восстановление ячеек',
      data: { slotLevel: Number(level), slotPool: rest, resourceChanges: [{ key: `spell:${rest}:${level}`, name: `Ячейка ${level} круга`,
        level: Number(level), pool: rest, delta: before - slot.used, remaining: slot.total - slot.used, total: slot.total }] } })
    emitChange()
  }

  return {
    slotPools,
    activeSlotPools,
    loadSlotPools,
    serializedSlotPools,
    toggleSlot,
    setTotal,
    adjustSlotUsed,
  }
}
