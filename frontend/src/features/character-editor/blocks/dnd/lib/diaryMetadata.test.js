import { describe, expect, it } from 'vitest'
import { diaryAuditRows, diarySourceLabel, formatDiaryTimestamp } from './diaryMetadata'

const created = { createdAt: '2026-09-08T07:00:00Z', changedAt: '2026-09-08T07:00:00Z', authorUserId: 1, authorName: 'Мастер', changedByUserId: 1, changedByName: 'Мастер' }
describe('journal entry metadata', () => {
  it('shows creation once until time or editor differs', () => {
    expect(diaryAuditRows(created)).toEqual([{ label: 'Создано', at: created.createdAt, author: 'Мастер' }])
    expect(diaryAuditRows({ ...created, changedAt: '2026-09-08T08:00:00Z' })).toHaveLength(2)
    expect(diaryAuditRows({ ...created, changedByUserId: 2, changedByName: 'Игрок' })[1].author).toBe('Игрок')
  })
  it('does not fabricate authors for old edits or metadata for unsaved drafts', () => {
    expect(diaryAuditRows({})).toEqual([])
    expect(diaryAuditRows({ createdAt: created.createdAt, changedAt: '2026-09-08T08:00:00Z' }).map(row => row.author))
      .toEqual(['Автор не сохранён', 'Автор правки не сохранён'])
    expect(formatDiaryTimestamp('invalid')).toBe('Время неизвестно')
  })
  it('retains scenario information after the original block was deleted', () => {
    expect(diarySourceLabel({})).toBe('')
    expect(diarySourceLabel({ sourceSnapshot: { scene: { name: 'Ворота' }, block: { title: 'Страж' } } }))
      .toBe('Из сценария · Ворота · Страж')
  })
})
