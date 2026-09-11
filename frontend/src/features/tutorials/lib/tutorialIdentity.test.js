import { describe, expect, it } from 'vitest'
import { hasSeenTutorial, tutorialKey } from './tutorialIdentity'
const context = { flowId: 'character', sourceKey: 'edition:1', device: 'desktop', revision: 2 }
describe('tutorial identity', () => {
  it('separates page, role, source and device, and replays revised flows', () => {
    const entries = [{ ...context, status: 'completed' }]
    expect(hasSeenTutorial(entries, context)).toBe(true)
    for (const patch of [{ flowId: 'session-dm' }, { sourceKey: 'edition:2' }, { device: 'mobile' }, { revision: 3 }]) {
      expect(hasSeenTutorial(entries, { ...context, ...patch })).toBe(false)
    }
    expect(tutorialKey(context)).not.toBe(tutorialKey({ ...context, sourceKey: 'source:1' }))
  })
  it('a dismissal suppresses automatic replay but does not claim completion', () => {
    const entries = [{ ...context, status: 'dismissed' }]
    expect(hasSeenTutorial(entries, context)).toBe(true)
    expect(entries[0].status).toBe('dismissed')
  })
})
