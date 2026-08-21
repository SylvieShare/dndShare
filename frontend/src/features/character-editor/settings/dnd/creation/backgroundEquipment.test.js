import { describe, expect, it } from 'vitest'
import {
  addStartingCoins,
  activeBackgroundChoices,
  backgroundChoiceProfile,
  backgroundChoicesComplete,
  backgroundReferenceIds,
  backgroundStartingEquipment,
  backgroundToolProficiencySelections,
  backgroundToolItems,
  formatStartingCoins,
} from './backgroundEquipment'

describe('background starting equipment', () => {
  const catalogue = [
    { id: 35, name: 'Дубинка', typeId: 1, data: { attacks: [{ damage: '1к4' }] } },
    { id: 417, name: 'Кошель', typeId: 2, data: { equipment_category: 'gear' }, svg: '<svg />' },
    { id: 4473, name: 'Инструменты навигатора', typeId: 2, data: { equipment_category: 'tool' } },
    { id: 500, name: 'Игровой набор (по выбору)', typeId: 2, data: { equipment_category: 'tool' } },
    { id: 501, name: 'Карты', typeId: 2, data: { equipment_category: 'tool' } },
    { id: 502, name: 'Кости', typeId: 2, data: { equipment_category: 'tool' } },
  ]

  it('resolves background possessions and wallet from canonical handbook ids', () => {
    const result = backgroundStartingEquipment({
      data: {
        equipment_items: [{ item_id: 35, count: 1 }, { item_id: 417, count: 2 }],
        starting_coins: [{ currency_id: 3, amount: 15 }],
      },
    }, catalogue)

    expect(result.items.map((item) => [item.item_id, item.name, item.count])).toEqual([
      [35, 'Дубинка', 1], [417, 'Кошель', 2],
    ])
    expect(result.items[0].typeId).toBe(1)
    expect(result.items[1].svg).toBe('<svg />')
    expect(result.coins).toEqual({ 3: 15 })
    expect(result.gold).toBe(15)
    expect(formatStartingCoins(result.coins)).toBe('15 зм')
  })

  it('resolves tool references independently and exposes all referenced ids', () => {
    const background = {
      item: { data: {
        tool_items: [{ item_id: 4473, count: 1 }],
        equipment_items: [{ item_id: 35, count: 1 }],
      } },
    }

    expect(backgroundToolItems(background, catalogue).map((item) => item.name)).toEqual(['Инструменты навигатора'])
    expect(backgroundReferenceIds(background)).toEqual([4473, 35])
  })

  it('preserves parameters carried by a granted item reference', () => {
    const rope = { id: 88, name: 'Верёвка шёлковая', typeId: 2, data: { measurement: 'length' } }
    const result = backgroundStartingEquipment({
      data: { equipment_items: [{ item_id: 88, count: 1, params: { length_ft: 30 } }] },
    }, [rope])

    expect(result.items[0]).toMatchObject({ item_id: 88, count: 1, params: { length_ft: 30 } })
  })

  it('resolves a data-driven background choice and replaces its generic tool grant', () => {
    const background = { data: {
      tool_items: [{ item_id: 500, count: 1 }],
      item_choices: [{
        key: 'gaming_set',
        label: 'Игровой набор',
        option_item_ids: [501, 502],
        grants_tool_proficiency: true,
        grants_tool_item: true,
        grants_equipment_item: false,
        replace_tool_prof_id: 22,
        replace_tool_item_id: 500,
      }],
    } }
    const profile = backgroundChoiceProfile(background, catalogue)

    expect(activeBackgroundChoices(profile).map((choice) => choice.key)).toEqual(['gaming_set'])
    expect(backgroundChoicesComplete(profile, {})).toBe(false)
    expect(backgroundChoicesComplete(profile, { gaming_set: 502 })).toBe(true)
    expect(backgroundToolItems(background, catalogue, { gaming_set: 502 }).map((item) => item.name)).toEqual(['Кости'])
    expect(backgroundToolProficiencySelections(profile, { gaming_set: 502 })).toEqual([
      { replaces: 22, name: 'Кости' },
    ])
    expect(backgroundReferenceIds(background)).toEqual([500, 501, 502])
  })

  it('does not require equipment-only choices when starting gear is replaced by the shop', () => {
    const profile = backgroundChoiceProfile({ data: { item_choices: [{
      key: 'con_prop',
      option_item_ids: [501, 502],
      grants_tool_proficiency: false,
      grants_equipment_item: true,
    }] } }, catalogue)

    expect(backgroundChoicesComplete(profile, {}, { includeEquipment: true })).toBe(false)
    expect(backgroundChoicesComplete(profile, {}, { includeEquipment: false })).toBe(true)
  })

  it('adds coins to the canonical wallet shape', () => {
    expect(addStartingCoins({ order: [1, 2, 3, 4, 5], amounts: { 3: 2 } }, { 3: 15 })).toEqual({
      order: [1, 2, 3, 4, 5],
      amounts: { 3: 17 },
    })
  })
})
