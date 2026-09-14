import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useSpellSlots } from './useSpellSlots'
import { useSpellbookTabs } from './useSpellbookTabs'

function setup(saved = {}, classes = [{ id: 1, level: 1 }]) {
  const automaticSlots = ref(saved.slots_auto !== false)
  let persisted
  const emitChange = () => {
    persisted = JSON.parse(JSON.stringify({
      slots_auto: automaticSlots.value,
      slot_pools: slots.serializedSlotPools(),
    }))
  }
  const slots = useSpellSlots({ canInteract: ref(true), automaticSlots, emitChange })
  const tabs = useSpellbookTabs({
    props: { values: { classes } },
    classItemMap: { 1: { id: 1, data: { caster_progression: 'full' } } },
    automaticSlots, replaceTotals: slots.replaceTotals, emitChange,
  })
  slots.loadSlotPools(saved)
  tabs.syncAutomaticSlotPools()
  return { ...slots, ...tabs, automaticSlots, saved: () => persisted }
}

describe('manual spell slot persistence', () => {
  it.each(['long_rest', 'short_rest'])('keeps added and spent %s slots after reload', (rest) => {
    const sheet = setup()
    sheet.setTotal(rest, 3, 2)
    sheet.toggleSlot(rest, 3, 1)

    const reloaded = setup(sheet.saved())
    expect(reloaded.serializedSlotPools()[rest]).toContainEqual({ level: 3, total: 2, used: 1 })
    expect(sheet.saved().slots_auto).toBe(false)
  })

  it('keeps manual slots for a character without caster classes', () => {
    const sheet = setup({}, [])
    sheet.setTotal('long_rest', 1, 1)
    expect(setup(sheet.saved(), []).serializedSlotPools().long_rest)
      .toEqual([{ level: 1, total: 1, used: 0 }])
  })

  it('keeps manual reductions and clamps spent slots after reload', () => {
    const sheet = setup()
    sheet.toggleSlot('long_rest', 1, 2)
    sheet.setTotal('long_rest', 1, 1)
    expect(setup(sheet.saved()).serializedSlotPools().long_rest)
      .toEqual([{ level: 1, total: 1, used: 1 }])
  })

  it('keeps automatic calculation when only spending or recovering slots', () => {
    const sheet = setup()
    sheet.toggleSlot('long_rest', 1, 1)
    expect(sheet.saved().slots_auto).toBe(true)
    const reloaded = setup(sheet.saved())
    expect(reloaded.serializedSlotPools().long_rest).toEqual([{ level: 1, total: 2, used: 1 }])
    reloaded.toggleSlot('long_rest', 1, 1)
    expect(reloaded.saved().slots_auto).toBe(true)
  })

  it('restores class totals when automatic calculation is explicitly enabled again', () => {
    const sheet = setup()
    sheet.setTotal('short_rest', 3, 2)
    sheet.setAutomaticSlots(true)
    expect(sheet.saved()).toEqual({
      slots_auto: true,
      slot_pools: { long_rest: [{ level: 1, total: 2, used: 0 }], short_rest: [] },
    })
  })
})
