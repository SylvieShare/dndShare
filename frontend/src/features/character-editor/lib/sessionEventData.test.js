import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { logResourceChange, logSpellSlotRecovery, instanceEventData } from './sessionEventData'
import { useSpellSlots } from '../blocks/dnd/composables/useSpellSlots'
import { useSpellCasting } from '../blocks/dnd/composables/useSpellCasting'

describe('chronicle resource events', () => {
  it('logs manual spending and recovery in both spell pools, ignores no-ops and total edits', () => {
    const log = vi.fn(), canInteract = ref(true)
    const api = useSpellSlots({ canInteract, automaticSlots: ref(true), emitChange: vi.fn(), logSessionEvent: log })
    api.loadSlotPools({ slot_pools: { short_rest: [{ level: 3, total: 3, used: 0 }], long_rest: [{ level: 1, total: 2, used: 0 }] } })
    api.toggleSlot('short_rest', 3, 2)
    api.toggleSlot('short_rest', 3, 1)
    api.adjustSlotUsed('long_rest', 1, 1)
    expect(log.mock.calls.map(([event]) => event.data.resourceChanges[0].delta)).toEqual([-2, 2, -1])
    expect(log.mock.calls[0][0].data).toMatchObject({ slotLevel: 3, slotPool: 'short_rest' })
    api.adjustSlotUsed('short_rest', 3, -10)
    api.toggleSlot('short_rest', 3, 0)
    api.toggleSlot('short_rest', 3, 5)
    api.setTotal('short_rest', 3, 2)
    canInteract.value = false
    api.toggleSlot('long_rest', 1, 2)
    expect(log).toHaveBeenCalledTimes(3)
  })
  it('records a paid cast exactly once with its source and slot, and does not charge slotless magic', () => {
    const log = vi.fn(), ctx = { ownerMode: true, logSessionEvent: log }
    const slots = useSpellSlots({ canInteract: ref(true), automaticSlots: ref(true), emitChange: vi.fn(), logSessionEvent: log })
    slots.loadSlotPools({ slot_pools: { short_rest: [{ level: 3, total: 2, used: 0 }] } })
    const casting = useSpellCasting({ charCtx: ctx, spellcastingBlocked: ref(false), ...slots, spellTitle: entry => entry.item.name })
    const entry = { item: { id: 42, name: 'Огненный шар', data: { lvl: 3 } }, ref: {} }
    expect(casting.useSpell(entry, { pool: 'short_rest', level: 3 })).toBe(true)
    expect(log).toHaveBeenCalledTimes(1)
    expect(log.mock.calls[0][0].data).toMatchObject({ source: { itemId: 42 }, resourceChanges: [{ delta: -1, level: 3, pool: 'short_rest' }] })
    expect(slots.serializedSlotPools().short_rest[0].used).toBe(1)
    casting.useSpell({ ...entry, ref: { slotless: true } }, { pool: 'slotless', level: 3 })
    expect(log.mock.calls[1][0].data.resourceChanges).toEqual([])
    expect(slots.serializedSlotPools().short_rest[0].used).toBe(1)
    expect(casting.useSpell(entry, { pool: 'long_rest', level: 9 })).toBe(false)
    expect(log).toHaveBeenCalledTimes(2)
  })
  it('preserves resource color, item source and actual clamped count in both directions', () => {
    const ctx = { logSessionEvent: vi.fn() }
    const resource = { key: 'charge', item_id: 5, title: 'Заряды', color_point: '#38bdf8', value: 2, total: 5 }
    logResourceChange(ctx, resource, -2)
    logResourceChange(ctx, resource, 10)
    expect(ctx.logSessionEvent.mock.calls.map(([event]) => event.data.resourceChanges[0].delta)).toEqual([-2, 3])
    expect(ctx.logSessionEvent.mock.calls[0][0].data).toMatchObject({ source: { itemId: 5 }, resourceChanges: [{ color: '#38bdf8', delta: -2 }] })
  })
  it('records restored spell slots per level and pool without inventing unused recovery', () => {
    const ctx = { logSessionEvent: vi.fn() }
    const before = { slot_pools: { long_rest: [{ level: 1, total: 3, used: 2 }], short_rest: [{ level: 2, total: 2, used: 1 }] } }
    logSpellSlotRecovery(ctx, before, { slot_pools: { ...before.slot_pools, short_rest: [{ level: 2, total: 2, used: 0 }] } })
    expect(ctx.logSessionEvent).toHaveBeenCalledTimes(1)
    expect(ctx.logSessionEvent.mock.calls[0][0].data).toMatchObject({ slotPool: 'short_rest', resourceChanges: [{ delta: 1 }] })
  })
  it('attributes weapon dependencies to the magical source rather than its physical base', () => {
    const ctx = { values: { weapon: [{ uid: 'w1', item_id: 1, magic_item_id: 19 }] }, characterResources: { itemsById: new Map([['19', { id: 19, name: 'Посох' }]]) } }
    expect(instanceEventData(ctx, 'w1')).toEqual({ source: { itemId: 19, name: 'Посох', instanceUid: 'w1' } })
  })
})
