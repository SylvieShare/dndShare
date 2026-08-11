import { describe, expect, it } from 'vitest'
import {
  createConsoleErrorCollector,
  formatConsoleArguments,
  formatConsoleValue,
} from './consoleErrorCapture'

describe('console error formatting', () => {
  it('formats errors and circular objects without throwing', () => {
    const value = { code: 500 }
    value.self = value

    expect(formatConsoleValue(value)).toContain('[Circular]')
    expect(formatConsoleArguments(['Request failed', new Error('boom')]))
      .toContain('Error: boom')
  })
})

describe('console error collector', () => {
  it('groups identical errors and counts every occurrence', () => {
    const collector = createConsoleErrorCollector()
    const error = {
      source: 'console.error',
      message: 'Request failed',
      detail: 'Request failed\nstatus 500',
      pageUrl: 'https://example.test/page',
    }

    collector.record({ ...error, createdAt: 10 })
    collector.record({ ...error, createdAt: 20 })

    const result = collector.snapshot()
    expect(result.totalCount).toBe(2)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]).toMatchObject({ count: 2, createdAt: 10, updatedAt: 20 })
  })

  it('keeps only the newest unique errors', () => {
    const collector = createConsoleErrorCollector(2)
    collector.record({ source: 'a', message: 'first' })
    collector.record({ source: 'b', message: 'second' })
    collector.record({ source: 'c', message: 'third' })

    expect(collector.snapshot().entries.map(entry => entry.message))
      .toEqual(['third', 'second'])
  })
})
