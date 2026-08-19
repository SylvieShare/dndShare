import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./AdminStats.vue', import.meta.url)), 'utf8')

describe('admin storage statistics', () => {
  it('renders the shared chart with the server storage breakdown', () => {
    expect(source).toContain("import { SegmentDonutChart } from '@sylvieshare/share-ui'")
    expect(source).toContain(':segments="storageSegments"')
    expect(source).toContain('stats.value?.storage || EMPTY_STORAGE')
    expect(source).toContain('category.fileCount')
    expect(source).toContain('storage.unknownFileCount')
  })

  it('keeps the storage dashboard responsive', () => {
    expect(source).toContain('@media (max-width: 980px)')
    expect(source).toContain('@media (max-width: 560px)')
    expect(source).toContain('grid-template-columns: 1fr;')
  })
})
