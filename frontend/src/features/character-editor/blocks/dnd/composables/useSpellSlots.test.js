import { describe, expect, it } from 'vitest'
import { ref } from 'vue'

import { useSpellSlots } from './useSpellSlots'

function setup() {
  let changes = 0
  return {
    changes: () => changes,
    api: useSpellSlots({ canInteract: ref(true), emitChange: () => { changes += 1 } }),
  }
}

describe('spell slot pools by recovery', () => {
  it('loads the canonical long and short rest pools', () => {
    const { api } = setup()
    api.loadSlotPools({ slot_pools: {
      long_rest: [{ level: 1, total: 3, used: 1 }],
      short_rest: [{ level: 2, total: 2, used: 1 }],
    } })
    expect(api.serializedSlotPools()).toEqual({
      long_rest: [{ level: 1, total: 3, used: 1 }],
      short_rest: [{ level: 2, total: 2, used: 1 }],
    })
  })

  it('supports arbitrary manual slot levels in either pool', () => {
    const { api } = setup()
    api.loadSlotPools({ slot_pools: {
      long_rest: [{ level: 1, total: 2, used: 0 }],
      short_rest: [{ level: 1, total: 1, used: 0 }, { level: 3, total: 2, used: 1 }],
    } })
    api.setTotal('short_rest', 2, 4)
    expect(api.serializedSlotPools().short_rest).toEqual([
      { level: 1, total: 1, used: 0 },
      { level: 2, total: 4, used: 0 },
      { level: 3, total: 2, used: 1 },
    ])
  })
})
