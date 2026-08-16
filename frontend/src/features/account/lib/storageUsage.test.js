import { describe, expect, it } from 'vitest'
import { formatBytes, formatStorageDate, hasKnownFileSize } from './storageUsage'

describe('storageUsage', () => {
  it('formats byte sizes with compact Russian units', () => {
    expect(formatBytes(0)).toBe('0 Б')
    expect(formatBytes(1024)).toBe('1 КБ')
    expect(formatBytes(1536)).toBe('1,5 КБ')
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 МБ')
  })

  it('distinguishes missing sizes from empty files', () => {
    expect(hasKnownFileSize(null)).toBe(false)
    expect(hasKnownFileSize(undefined)).toBe(false)
    expect(hasKnownFileSize(0)).toBe(true)
    expect(formatBytes(null)).toBe('Размер неизвестен')
  })

  it('does not render invalid dates', () => {
    expect(formatStorageDate('not-a-date')).toBe('')
  })
})
