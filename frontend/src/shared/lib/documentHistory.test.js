import { expect, it } from 'vitest'
import { createDocumentChange, applyDocumentChange } from './documentHistory'
it('undoes ordering without undoing independent changes inside an entry', () => {
  const before = {
      items: [
        { uid: 'a', count: 1 },
        { uid: 'b', count: 1 },
      ],
    },
    after = {
      items: [
        { uid: 'b', count: 1 },
        { uid: 'a', count: 1 },
      ],
    }
  const step = createDocumentChange(before, after)
  const remote = {
    items: [
      { uid: 'b', count: 2 },
      { uid: 'a', count: 1 },
    ],
  }
  expect(applyDocumentChange(remote, step, false)).toEqual({
    items: [
      { uid: 'a', count: 1 },
      { uid: 'b', count: 2 },
    ],
  })
  expect(JSON.stringify(step.after)).not.toContain('count')
})
