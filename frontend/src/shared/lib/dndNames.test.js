import { describe, expect, it } from 'vitest'
import { dndNamePoolSize, dndNameProfile, randomDndName } from './dndNames'

describe('race-aware D&D names', () => {
  it('uses the most specific race profile before a shared word fragment', () => {
    expect(dndNameProfile({ name: 'Полуэльф' }).key).toBe('half-elf')
    expect(dndNameProfile({ name: 'Лесной эльф' }).key).toBe('elf')
    expect(dndNameProfile({ nameEn: 'Half-Orc' }).key).toBe('half-orc')
  })

  it('offers a substantial combination pool for every built-in profile', () => {
    for (const race of ['Человек', 'Дварф', 'Эльф', 'Полурослик', 'Гном', 'Полуэльф', 'Полуорк', 'Драконорождённый', 'Тифлинг']) {
      expect(dndNamePoolSize(race)).toBeGreaterThanOrEqual(80)
    }
  })

  it('generates deterministically with an injected random source and avoids an unchanged reroll', () => {
    expect(randomDndName('Эльф', () => 0)).toBe('Ариэль Белая Ива')
    expect(randomDndName('Эльф', () => 0, 'Ариэль Белая Ива')).toBe('Ариэль Вечерняя Звезда')
  })

  it('uses a broad fantasy fallback for custom handbook races', () => {
    expect(dndNameProfile({ name: 'Кристаллический народ' }).key).toBe('fantasy')
    expect(dndNamePoolSize('Кристаллический народ')).toBeGreaterThanOrEqual(100)
  })
})
