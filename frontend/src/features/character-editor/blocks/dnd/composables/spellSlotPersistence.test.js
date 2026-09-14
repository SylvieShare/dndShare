import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useSpellSlots } from './useSpellSlots'
import { useSpellbookTabs } from './useSpellbookTabs'

vi.mock('@/shared/api/itemsApi', () => ({ itemsApi: {
  byIds: vi.fn(async () => ({ items: [{ id: 1, data: { caster_progression: 'full' } }] })),
} }))

async function setup(saved = {}, classes = [{ id: 1, level: 1 }]) {
  let persisted
  const emitChange = () => { persisted = JSON.parse(JSON.stringify({ slot_pools: slots.serializedSlotPools() })) }
  const slots = useSpellSlots({ canInteract: ref(true), emitChange })
  const props = { values: { classes } }
  const tabs = useSpellbookTabs({
    props, classItemMap: {}, tabs: ref([]), activeSpellTab: ref(''), emitChange,
  })
  slots.loadSlotPools(saved)
  await tabs.loadClassItems()
  return { ...slots, props, ...tabs, saved: () => persisted }
}

describe('spell slot persistence', () => {
  it.each(['long_rest', 'short_rest'])('keeps added and spent %s slots after reload', async (rest) => {
    const sheet = await setup()
    sheet.setTotal(rest, 3, 2)
    sheet.toggleSlot(rest, 3, 1)
    const reloaded = await setup(sheet.saved())
    expect(reloaded.serializedSlotPools()[rest]).toEqual([{ level: 3, total: 2, used: 1 }])
  })

  it('does not fill empty pools from classes when loading the sheet', async () => {
    expect((await setup()).serializedSlotPools()).toEqual({ long_rest: [], short_rest: [] })
  })

  it('keeps manual slots when class data changes or no caster class exists', async () => {
    const sheet = await setup({}, [])
    sheet.setTotal('long_rest', 1, 1)
    sheet.props.values.classes = [{ id: 1, level: 5 }]
    await sheet.loadClassItems()
    expect(sheet.serializedSlotPools().long_rest).toEqual([{ level: 1, total: 1, used: 0 }])
    expect((await setup(sheet.saved(), [])).serializedSlotPools()).toEqual(sheet.serializedSlotPools())
  })

  it('preserves zeroed totals and stocks above nine after reload', async () => {
    const sheet = await setup({ slot_pools: { long_rest: [{ level: 1, total: 2, used: 2 }] } })
    sheet.setTotal('long_rest', 1, 0)
    sheet.setTotal('short_rest', 2, 12)
    sheet.toggleSlot('short_rest', 2, 10)
    expect((await setup(sheet.saved())).serializedSlotPools()).toEqual({
      long_rest: [], short_rest: [{ level: 2, total: 12, used: 10 }],
    })
  })
})
