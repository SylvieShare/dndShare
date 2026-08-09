import { describe, expect, it } from 'vitest'
import {
  errorReportStatusKey,
  errorReportStatusLabel,
  errorReportStatusSummary,
  errorReportDisplayTitle,
  shouldShowErrorReportAuthor,
} from './errorReportPresentation'

describe('error report presentation', () => {
  it('prioritizes terminal and blocking statuses', () => {
    expect(errorReportStatusKey({ status: 'RESOLVED', waitingForAnswer: true })).toBe('RESOLVED')
    expect(errorReportStatusLabel({ status: 'IN_PROGRESS', approved: true })).toBe('В работе')
    expect(errorReportStatusKey({ status: 'OPEN', waitingForSeriousApproval: true, waitingForAnswer: true })).toBe('APPROVAL')
    expect(errorReportStatusLabel({ status: 'OPEN', waitingForAnswer: true })).toBe('Ждёт ответа')
    expect(errorReportStatusLabel({ status: 'OPEN', approved: false })).toBe('Не одобрена')
  })

  it('hides only the current signed-in author', () => {
    expect(shouldShowErrorReportAuthor({ userId: 7 }, 7)).toBe(false)
    expect(shouldShowErrorReportAuthor({ userId: 8 }, 7)).toBe(true)
    expect(shouldShowErrorReportAuthor({ userId: null }, 7)).toBe(true)
  })

  it('groups compact inbox chips by visible status', () => {
    expect(errorReportStatusSummary([
      { status: 'OPEN', approved: true },
      { status: 'OPEN', approved: true },
      { status: 'OPEN', approved: false },
      { status: 'OPEN', waitingForAnswer: true },
      { status: 'IN_PROGRESS' },
      { status: 'RESOLVED' },
    ])).toEqual([
      { key: 'OPEN', label: 'В очереди', count: 2 },
      { key: 'IN_PROGRESS', label: 'В работе', count: 1 },
      { key: 'ANSWER', label: 'Ждёт ответа', count: 1 },
      { key: 'UNAPPROVED', label: 'Не одобрена', count: 1 },
      { key: 'RESOLVED', label: 'Завершена', count: 1 },
    ])
  })

  it('uses a truncated description until the AI supplies a title', () => {
    expect(errorReportDisplayTitle({ title: '  Готовый заголовок  ', description: 'Описание' })).toBe('Готовый заголовок')
    expect(errorReportDisplayTitle({ title: null, description: 'Очень длинное описание ошибки' }, 12)).toBe('Очень длинн…')
  })
})
