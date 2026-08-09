import { describe, expect, it } from 'vitest'
import { addStartingCoins, backgroundStartingEquipment, formatStartingCoins } from './backgroundEquipment'

describe('background starting equipment', () => {
  it('separates inventory rows from a wallet with gold', () => {
    const result = backgroundStartingEquipment({
      data: { equipment: '<p>Священный символ, молитвенник, 5 палочек благовоний, облачение, обычная одежда, кошель с 15 зм.</p>' },
    })

    expect(result.items.map((item) => item.name)).toEqual([
      'Священный символ', 'молитвенник', '5 палочек благовоний', 'облачение', 'обычная одежда',
    ])
    expect(result.coins).toEqual({ 3: 15 })
    expect(result.gold).toBe(15)
    expect(formatStartingCoins(result.coins)).toBe('15 зм')
  })

  it('recognizes gold without a wallet phrase and keeps measurements as items', () => {
    const result = backgroundStartingEquipment({
      item: { data: { equipment: '<p>Шёлковая верёвка 15 м, зимнее одеяло, 5 зм.</p>' } },
    })

    expect(result.items.map((item) => item.name)).toEqual(['Шёлковая верёвка 15 м', 'зимнее одеяло'])
    expect(result.coins).toEqual({ 3: 5 })
  })

  it('adds coins to the canonical wallet shape', () => {
    expect(addStartingCoins({ order: [1, 2, 3, 4, 5], amounts: { 3: 2 } }, { 3: 15 })).toEqual({
      order: [1, 2, 3, 4, 5],
      amounts: { 3: 17 },
    })
  })
})
