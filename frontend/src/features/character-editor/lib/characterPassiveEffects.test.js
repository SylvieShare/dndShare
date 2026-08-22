import { describe, expect, it } from 'vitest'
import { collectCharacterPassiveEffects } from './characterPassiveEffects'

describe('character passive effects', () => {
  it('collects level-gated read-only rows from abilities', () => {
    const values = { lvl: { level: 2 }, abilities_race: [{ id: 8 }] }
    const items = new Map([['8', { id: 8, name: 'Храбрый', data: { passive_effects: [{ title: 'Преимущество против испуга', level: 1 }] } }]])
    expect(collectCharacterPassiveEffects(values, items)).toMatchObject([{
      title: 'Преимущество против испуга',
      source_label: 'Храбрый',
    }])
  })
})

