import { describe, expect, it } from 'vitest'
import { hasSeenTutorial, tutorialKey } from './tutorialIdentity'
const context = { flowId: 'character', sourceKey: 'edition:1', device: 'desktop', revision: 2 }
describe('tutorial identity', () => {
  it('separates page, role, source and device', () => {
    const entries = [{ ...context, status: 'completed' }]
    expect(hasSeenTutorial(entries, context)).toBe(true)
    for (const patch of [{ flowId: 'session-dm' }, { sourceKey: 'edition:2' }, { device: 'mobile' }]) {
      expect(hasSeenTutorial(entries, { ...context, ...patch })).toBe(false)
    }
    expect(tutorialKey(context)).not.toBe(tutorialKey({ ...context, sourceKey: 'source:1' }))
  })
  it.each(['completed', 'dismissed'])('keeps %s progress across scenario revisions', status => {
    const entries = [{ ...context, status }]
    for (const revision of [1, 2, 3]) {
      expect(hasSeenTutorial(entries, { ...context, revision })).toBe(true)
    }
    expect(entries[0].status).toBe(status)
  })
  it('allows automatic start after the saved result is reset', () => {
    expect(hasSeenTutorial([], context)).toBe(false)
  })
})
