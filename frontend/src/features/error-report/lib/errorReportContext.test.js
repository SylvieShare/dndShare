import { describe, expect, it } from 'vitest'
import { platformForViewport } from './errorReportContext'

describe('error report context', () => {
  it('uses the application header breakpoint for platform metadata', () => {
    expect(platformForViewport(599)).toBe('mobile')
    expect(platformForViewport(600)).toBe('tablet')
    expect(platformForViewport(1199)).toBe('tablet')
    expect(platformForViewport(1200)).toBe('desktop')
  })
})
