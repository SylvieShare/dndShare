import { ref } from 'vue'
import { groupedSpellSlotOptions as groupedSlotOptions, availableSpellSlotOptions as availableSlotOptions } from '../lib/spellUse'

export function useSpellCasting({ charCtx, spellcastingBlocked, slotPools }) {
  const rollLevels = ref({})
  const key = entry => entry.ref?.key || `${entry.item?.id}:${entry.ref?.source_key || ''}`
  const spellRollLevel = (entry, fallback) => rollLevels.value[key(entry)] ?? fallback
  const rememberSpellRollLevel = (entry, level) => { rollLevels.value[key(entry)] = level }

  function availableSpellSlotOptions(entry) {
    const level = Number(entry?.item?.data?.lvl) || 0
    if (entry?.ref?.slotless) return [{ pool: 'slotless', level: Number(entry?.ref?.cast_level) || level, remaining: null }]
    return availableSlotOptions(slotPools.value, level)
  }

  const groupedSpellSlotOptions = entry => groupedSlotOptions(slotPools.value, Number(entry?.item?.data?.lvl) || 0)

  async function useSpell(entry, slotOption) {
    if (!charCtx.ownerMode || !entry?.item || spellcastingBlocked.value) return false
    const spellLevel = Number(entry?.item?.data?.lvl) || 0
    const option = typeof slotOption === 'object' && slotOption
      ? slotOption
      : { pool: 'long_rest', level: Number(slotOption) || 0 }
    if (spellLevel > 0 && !entry.ref?.slotless) {
      const available = availableSpellSlotOptions(entry)
      if (!available.some((candidate) => candidate.pool === option.pool && candidate.level === option.level)) return false

    }
    return await charCtx.itemTransfers?.castSpell(entry, {
      manual: true, targets: [], dmCount: 0,
      castLevel: spellLevel === 0 ? 0 : option.level,
      pool: spellLevel === 0 ? 'cantrip' : entry.ref?.slotless ? 'slotless' : option.pool,
      spendSlot: spellLevel > 0 && !entry.ref?.slotless,
    }) === true
  }

  return { groupedSpellSlotOptions, availableSpellSlotOptions, useSpell, spellRollLevel, rememberSpellRollLevel }
}
