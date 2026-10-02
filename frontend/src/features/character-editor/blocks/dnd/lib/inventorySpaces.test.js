import { describe, expect, it } from 'vitest'
import { canEquipInventoryItem, inventorySpaceEntries, isInventoryEquipped, moveInventoryCell, normalizeInventorySpaces, toggleInventoryEquipment } from './inventorySpaces'
import { cloneModel, normalizeValue } from './itemSection'
import { deriveEquippedArmor } from './equippedArmor'
import { magicItemActive } from '@/features/character-editor/lib/characterMagicItems'

const entry = uid => ({ uid, item_id: 12, count: 1, params: { magic: { remaining: 3 } } })
function model() {
  return normalizeValue({ equipped: [entry('worn')], sections: [
    { id: 'bag', items: [entry('a'), entry('b')], slots: { a: 0, b: 1, worn: 2 } },
    { id: 'chest', items: [entry('c')], slots: { c: 1 } },
  ] })
}

describe('inventory spaces and equipment', () => {
  it('locates existing equipped entries once without changing their mechanics state', () => {
    const next = normalizeValue({ equipped: [entry('worn')], sections: [{ id: 'bag', items: [entry('a')] }, { id: 'chest', items: [] }] })
    expect(inventorySpaceEntries(next, 'bag').map(e => e.uid)).toEqual(['a', 'worn'])
    expect(next.sections[0].slots).toEqual({ a: 0, worn: 1 })
    next.sections[1].slots.worn = 3
    normalizeInventorySpaces(next)
    expect(inventorySpaceEntries(next, 'chest')).toHaveLength(0)
    expect(next.equipped).toHaveLength(1)
  })
  it('equips and removes in place, preserving identity, count and resource parameters', () => {
    const next = model(), slots = structuredClone(next.sections[0].slots), original = structuredClone(next.sections[0].items[0])
    expect(toggleInventoryEquipment(next, 'a')).toBe(true)
    expect(isInventoryEquipped(next, 'a')).toBe(true)
    expect(next.equipped.find(e => e.uid === 'a')).toEqual(original)
    normalizeInventorySpaces(next)
    expect(next.sections[0].slots).toEqual(slots)
    toggleInventoryEquipment(next, 'a')
    normalizeInventorySpaces(next)
    expect(next.sections[0].items.find(e => e.uid === 'a')).toEqual(original)
    expect(next.sections[0].slots).toEqual(slots)
    expect(isInventoryEquipped(next, 'a')).toBe(false)
  })
  it('moves an equipped item between spaces without unequipping it', () => {
    const next = model()
    moveInventoryCell(next, { uid: 'worn', fromId: 'bag', toId: 'chest', toSlot: 3 })
    normalizeInventorySpaces(next)
    expect(next.sections[1].slots.worn).toBe(3)
    expect(next.sections[0].slots).toEqual({ a: 0, b: 1 })
    expect(isInventoryEquipped(next, 'worn')).toBe(true)
    expect(inventorySpaceEntries(cloneModel(normalizeValue(next)), 'chest').map(e => e.uid)).toContain('worn')
  })
  it('swaps equipped and carried items across spaces and within a space', () => {
    const next = model()
    moveInventoryCell(next, { uid: 'worn', fromId: 'bag', toId: 'chest', toSlot: 1 })
    normalizeInventorySpaces(next)
    expect(next.sections[0].slots).toEqual({ a: 0, b: 1, c: 2 })
    expect(next.sections[1].slots).toEqual({ worn: 1 })
    expect(next.sections[0].items.map(e => e.uid)).toContain('c')
    moveInventoryCell(next, { uid: 'a', fromId: 'bag', toId: 'bag', toSlot: 2 })
    expect(next.sections[0].slots).toEqual({ a: 2, b: 1, c: 0 })
    expect(isInventoryEquipped(next, 'worn')).toBe(true)
  })
  it('preserves the source hole for a free drop and ignores invalid/self drops', () => {
    const next = model(), before = structuredClone(next)
    expect(moveInventoryCell(next, { uid: 'a', fromId: 'bag', toId: 'bag', toSlot: 0 })).toBe(false)
    expect(moveInventoryCell(next, { uid: 'missing', fromId: 'bag', toId: 'chest', toSlot: 0 })).toBe(false)
    expect(next).toEqual(before)
    moveInventoryCell(next, { uid: 'a', fromId: 'bag', toId: 'chest', toSlot: 0 })
    expect(next.sections[0].slots).toEqual({ b: 1, worn: 2 })
    expect(next.sections[1].slots).toEqual({ c: 1, a: 0 })
  })
  it('offers equipment only for weapons, armor and magic requiring equipment', () => {
    expect(canEquipInventoryItem({ typeId: 12 })).toBe(true)
    expect(canEquipInventoryItem({ typeId: 1 })).toBe(true)
    expect(canEquipInventoryItem({ typeId: 19, data: { activation: 'equipped' } })).toBe(true)
    expect(canEquipInventoryItem({ typeId: 19, data: { activation: 'carried', confirmed_uses: [{ activation: 'equipped' }] } })).toBe(true)
    expect(canEquipInventoryItem({ typeId: 19, data: { activation: 'carried' } })).toBe(false)
    expect(canEquipInventoryItem({ typeId: 2 })).toBe(false)
    expect(canEquipInventoryItem({ typeId: 10 })).toBe(false)
    expect(canEquipInventoryItem(null)).toBe(false)
  })
  it('continues to drive armor and magic activation from equipped storage', () => {
    const armor = { id: 12, typeId: 12, data: { armor: { ac: 15, use_dex: false } } }
    const next = normalizeValue({ equipped: [], sections: [{ id: 'bag', items: [entry('armor')] }] })
    expect(deriveEquippedArmor({ items: next }, { 12: armor }).total).toBe(10)
    toggleInventoryEquipment(next, 'armor')
    expect(deriveEquippedArmor({ items: next }, { 12: armor }).total).toBe(15)
    const magic = { typeId: 19, data: { activation: 'equipped', attunement: 'none' } }
    expect(magicItemActive(magic, next.equipped[0], isInventoryEquipped(next, 'armor'))).toBe(true)
    toggleInventoryEquipment(next, 'armor')
    expect(deriveEquippedArmor({ items: next }, { 12: armor }).total).toBe(10)
    expect(magicItemActive(magic, next.sections[0].items[0], false)).toBe(false)
  })
})
