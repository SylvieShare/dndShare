import { describe, expect, it } from 'vitest'
import {
  errorReportStatusKey,
  errorReportStatusLabel,
  shouldShowErrorReportAuthor,
} from './errorReportPresentation'

describe('error report presentation', () => {
  it('prioritizes terminal and blocking statuses', () => {
    expect(errorReportStatusKey({ status: 'RESOLVED', waitingForAnswer: true })).toBe('RESOLVED')
    expect(errorReportStatusKey({ status: 'OPEN', waitingForSeriousApproval: true, waitingForAnswer: true })).toBe('APPROVAL')
    expect(errorReportStatusLabel({ status: 'OPEN', waitingForAnswer: true })).toBe('Ждёт ответа')
    expect(errorReportStatusLabel({ status: 'OPEN', approved: false })).toBe('Не одобрена')
  })

  it('hides only the current signed-in author', () => {
    expect(shouldShowErrorReportAuthor({ userId: 7 }, 7)).toBe(false)
    expect(shouldShowErrorReportAuthor({ userId: 8 }, 7)).toBe(true)
    expect(shouldShowErrorReportAuthor({ userId: null }, 7)).toBe(true)
  })
})
