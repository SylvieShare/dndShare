import { describe, expect, it, vi } from 'vitest'
import { logSessionEntryAdded } from './sessionEntryEvents'

describe('session entry events', () => {
  it('normalizes a character entry addition', () => {
    const logSessionEvent = vi.fn()

    logSessionEntryAdded({ logSessionEvent }, {
      kind: 'spell', title: ' Огненный шар ', itemId: 42, level: 3,
    })

    expect(logSessionEvent).toHaveBeenCalledWith({
      type: 'entry_added',
      action: 'Добавлено заклинание: Огненный шар',
      data: { kind: 'spell', itemId: 42, count: 1, level: 3 },
    })
  })

  it('ignores unknown entry kinds and empty titles', () => {
    const logSessionEvent = vi.fn()
    logSessionEntryAdded({ logSessionEvent }, { kind: 'unknown', title: 'Что-то' })
    logSessionEntryAdded({ logSessionEvent }, { kind: 'item', title: ' ' })
    expect(logSessionEvent).not.toHaveBeenCalled()
  })
})
