import { describe, expect, it } from 'vitest'
import { raceImageFor } from './raceVisuals'

describe('race visuals', () => {
  it('uses the storage image projected by the race item', () => {
    expect(raceImageFor({ name: 'Тифлинг', iconImageUrl: 'https://storage.example/tiefling.jpg' }))
      .toBe('https://storage.example/tiefling.jpg')
  })

  it('leaves a race without an item image to the monogram fallback', () => {
    expect(raceImageFor({ name: 'Автогном' })).toBe('')
  })
})
