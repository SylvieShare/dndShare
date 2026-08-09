import { describe, expect, it } from 'vitest'
import { platformForViewport } from './errorReportContext'

describe('error report context', () => {
  it('uses the application header breakpoint for platform metadata', () => {
    expect(platformForViewport(640)).toBe('mobile')
    expect(platformForViewport(641)).toBe('desktop')
  })
})
