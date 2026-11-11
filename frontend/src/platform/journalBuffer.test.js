import { expect, it, vi } from 'vitest'
import { createJournalBuffer } from './journalBuffer'

it('retains a failed local write and never reports it durable until retry succeeds', async () => {
  const database = { batch: vi.fn().mockRejectedValue(new Error('disk full')) }
  const journal = createJournalBuffer(database)
  journal.setItem('sheet', 'first')
  await expect(journal.flush()).rejects.toThrow('disk full')
  await expect(journal.flush()).rejects.toThrow('disk full')
  database.batch.mockResolvedValue(undefined)
  await journal.flush()
  expect(database.batch).toHaveBeenLastCalledWith([{ key: 'journal:sheet', value: 'first' }])
})

it('keeps the newest value when a failed transaction overlaps later input', async () => {
  let reject
  const database = { batch: vi.fn().mockImplementationOnce(() => new Promise((_, fail) => { reject = fail })).mockResolvedValue(undefined) }
  const journal = createJournalBuffer(database)
  journal.setItem('sheet', 'old')
  journal.setItem('sheet', 'new')
  journal.setItem('map', 'map state')
  reject(new Error('interrupted'))
  await journal.flush()
  expect(database.batch).toHaveBeenLastCalledWith([{ key: 'journal:sheet', value: 'new' }, { key: 'journal:map', value: 'map state' }])
})
