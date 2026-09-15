import { itemEventData } from '@/features/character-editor/lib/sessionEventData'
import { ref } from 'vue'
import { availableSpellSlotOptions as availableSlotOptions } from '../lib/spellUse'

export function useSpellCasting({ charCtx, spellcastingBlocked, slotPools, adjustSlotUsed, spellTitle }) {
  const rollLevels = ref({})
  const key = entry => entry.ref?.key || `${entry.item?.id}:${entry.ref?.source_key || ''}`
  const spellRollLevel = (entry, fallback) => rollLevels.value[key(entry)] ?? fallback
  const rememberSpellRollLevel = (entry, level) => { rollLevels.value[key(entry)] = level }

  function availableSpellSlotOptions(entry) {
    const level = Number(entry?.item?.data?.lvl) || 0
    if (entry?.ref?.slotless) return [{ pool: 'slotless', level: Number(entry?.ref?.cast_level) || level, remaining: null }]
    return availableSlotOptions(slotPools.value, level)
  }

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
    if (entry.item.data?.concentration && !await charCtx.itemTransfers?.concentration.start(entry.item)) return false
    if (spellLevel > 0 && !entry.ref?.slotless) adjustSlotUsed(option.pool, option.level, 1, { log: false })
    charCtx.logSessionEvent?.({
      type: 'spell_used',
      action: `Использовано: ${spellTitle(entry)}`,
      data: {
        ...itemEventData(entry.item),
        resourceChanges: spellLevel > 0 && !entry.ref?.slotless ? [{ key: `spell:${option.pool}:${option.level}`, name: `Ячейка ${option.level} круга`,
          level: option.level, pool: option.pool, delta: -1 }] : [],
        spellId: entry?.item?.id || entry?.ref?.id || null,
        spellLevel,
        slotLevel: spellLevel === 0 ? 0 : option.level,
        slotPool: spellLevel === 0 ? 'cantrip' : option.pool,
      },
    })
    const states = charCtx.characterStatuses?.endOn?.('spell_cast')
    if (states) charCtx.updateValues({ states })
    return true
  }

  return { availableSpellSlotOptions, useSpell, spellRollLevel, rememberSpellRollLevel }
}
