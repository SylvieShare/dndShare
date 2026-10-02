import { describe, expect, it } from 'vitest'
import { customInventoryIcon, selectableIconPresets } from './iconPresets'
import { cloneModel, entryDisplayData, normalizeValue } from '@/features/character-editor/blocks/dnd/lib/itemSection'

const presets = [
  { id: 1, itemTypeId: 2, purpose: 'item', imageUrl: '/key.webp' },
  { id: 2, itemTypeId: 1, purpose: 'item', imageUrl: '/sword.webp' },
  { id: 3, itemTypeId: 2, purpose: 'empty_cell', imageUrl: '/empty.webp' },
]
const byId = Object.fromEntries(presets.map(preset => [preset.id, preset]))

describe('simplified inventory artwork', () => {
  it('offers only item presets from the requested collections', () => {
    expect(selectableIconPresets(presets, [2]).map(preset => preset.id)).toEqual([1])
    expect(selectableIconPresets(presets, [2, 1]).map(preset => preset.id)).toEqual([1, 2])
  })
  it('keeps the selected identity through normalization, editing and inventory moves', () => {
    const model = cloneModel(normalizeValue({ sections: [{ id: 'bag', items: [{ uid: 'key', item_id: null, icon_preset_id: 1, override: { name: 'Ключ от башни' } }] }] }))
    const entry = model.sections[0].items.pop()
    model.equipped.push(entry)
    expect(entryDisplayData(entry, {}, {}, 2, byId)).toMatchObject({ name: 'Ключ от башни', iconImageUrl: '/key.webp', typeImageUrl: '' })
    expect(cloneModel(model).equipped[0].icon_preset_id).toBe(1)
  })
  it('retains type artwork for unset, absent and empty-cell presets', () => {
    for (const id of [null, 999, 3]) {
      expect(entryDisplayData({ item_id: null, icon_preset_id: id }, {}, { 2: { iconImageUrl: '/default.webp' } }, 2, byId).typeImageUrl).toBe('/default.webp')
    }
  })
  it('keeps handbook icons independent of a custom preset', () => {
    const entry = { item_id: 10, icon_preset_id: 1 }
    expect(customInventoryIcon(entry, byId)).toBe('')
    expect(entryDisplayData(entry, { 10: { iconImageUrl: '/handbook.webp' } }, {}, 2, byId).iconImageUrl).toBe('/handbook.webp')
  })
})
