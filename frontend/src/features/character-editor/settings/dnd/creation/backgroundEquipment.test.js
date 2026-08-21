import { describe, expect, it } from 'vitest'
import {
  addStartingCoins,
  backgroundReferenceIds,
  backgroundStartingEquipment,
  backgroundToolItems,
  formatStartingCoins,
} from './backgroundEquipment'

describe('background starting equipment', () => {
  const catalogue = [
    { id: 35, name: 'Дубинка', typeId: 1, data: { attacks: [{ damage: '1к4' }] } },
    { id: 417, name: 'Кошель', typeId: 2, data: { equipment_category: 'gear' }, svg: '<svg />' },
    { id: 4473, name: 'Инструменты навигатора', typeId: 2, data: { equipment_category: 'tool' } },
  ]

  it('resolves background possessions and wallet from canonical handbook ids', () => {
    const result = backgroundStartingEquipment({
      data: {
        equipment_items: [{ item_id: 35, count: 1 }, { item_id: 417, count: 2 }],
        starting_coins: [{ currency_id: 3, amount: 15 }],
      },
    }, catalogue)

    expect(result.items.map((item) => [item.id, item.name, item.count])).toEqual([
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

  it('adds coins to the canonical wallet shape', () => {
    expect(addStartingCoins({ order: [1, 2, 3, 4, 5], amounts: { 3: 2 } }, { 3: 15 })).toEqual({
      order: [1, 2, 3, 4, 5],
      amounts: { 3: 17 },
    })
  })
})
