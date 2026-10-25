import { expect, it } from 'vitest'
import { takeDocumentBatch } from './documentBatch'

it('keeps queued edits within the server metadata limit as well as the operation limit', () => {
  const groups = Array.from({ length: 1001 }, (_, value) => ({ patches: [{ op: 'set', path: ['count'], value }], metadata: {} }))
  const first = takeDocumentBatch(groups, 1)
  expect(first.packet.metadata).toHaveLength(1000)
  expect(groups).toHaveLength(1)
  const second = takeDocumentBatch(groups, 2)
  expect(second.packet.patches).toEqual([{ op: 'set', path: ['count'], value: 1000 }])
})
