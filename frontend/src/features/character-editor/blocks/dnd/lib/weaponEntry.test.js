import { describe, expect, it } from 'vitest'
import { cleanEntry, defaultEntry } from './weaponEntry'

describe('weapon item instances', () => {
  it('stores the magic bonus only in typed instance params', () => {
    expect(defaultEntry()).toMatchObject({ item_id: null, params: { magic_bonus: 0 } })
    const clean = cleanEntry({
      item_id: 17,
      params: { magic_bonus: 2 },
      stat_suggest_id: null,
      proficient: true,
      add_attacks: [],
      desc: '',
    })
    expect(clean.params).toEqual({ magic_bonus: 2 })
    expect(clean).not.toHaveProperty('magic_up')
  })
})
