import { describe, expect, it } from 'vitest'
import { officialCombatActions } from './combatActions'

describe('official combat actions', () => {
  it('filters homebrew rows and keeps canonical rules order', () => {
    const actions = officialCombatActions([
      { id: 9, code: 'dash', value: 'Рывок' },
      { id: 10, code: 'attack', value: 'Атака' },
      { id: 11, code: 'custom', value: 'Трюк', userId: 7 },
      { id: 12, code: 'cast-spell', value: 'Наложение заклинания' },
    ])

    expect(actions.map(action => action.code)).toEqual(['attack', 'cast-spell', 'dash'])
  })
})
