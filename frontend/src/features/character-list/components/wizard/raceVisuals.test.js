import { describe, expect, it } from 'vitest'
import { normalizeRaceName, raceImageFor } from './raceVisuals'

describe('race visuals', () => {
  it('normalizes localized and hyphenated race names', () => {
    expect(normalizeRaceName('Полу-эльф')).toBe('полуэльф')
    expect(normalizeRaceName('Драконорождённый')).toBe('драконорожденный')
  })

  it('finds built-in art by Russian and English names', () => {
    expect(raceImageFor({ name: 'Тифлинг' })).toBe('/static/races/tiefling.jpg')
    expect(raceImageFor({ name: 'Неизвестно', nameEn: 'Half-Orc' })).toBe('/static/races/half-orc.jpg')
  })

  it('falls back to an item image for custom races', () => {
    expect(raceImageFor({ name: 'Автогном', iconImageUrl: '/custom.png' })).toBe('/custom.png')
  })
})
