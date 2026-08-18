import { describe, expect, it } from 'vitest'
import { raceCoverFor } from './raceVisuals'

describe('race visuals', () => {
  it('uses the cover projected by the race item instead of its icon', () => {
    expect(raceCoverFor({
      name: 'Тифлинг',
      coverImageUrl: 'https://storage.example/tiefling-cover.jpg',
      iconImageUrl: 'https://storage.example/tiefling-icon.webp',
    })).toBe('https://storage.example/tiefling-cover.jpg')
  })

  it('leaves a race without a cover to the monogram fallback', () => {
    expect(raceCoverFor({ name: 'Автогном', iconImageUrl: 'https://storage.example/autognome.webp' })).toBe('')
  })
})
