import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ItemPickerModal.vue', import.meta.url)), 'utf8')

describe('handbook item picker controls', () => {
  it('reuses handbook filters, sources and nested grouping', () => {
    expect(source).toContain('<HandbookItemList')
    expect(source).toContain('show-controls')
    expect(source).toContain(':content-sources="visibleContentSources"')
    expect(source).toContain('@update:search="searchQ = $event"')
    expect(source).toContain('@update:filters="filters = $event"')
    expect(source).toContain('walkFieldsWithPath(itemType.value?.fields || [])')
    expect(source).toContain('@update:group-by="groupBy = $event"')
    expect(source).toContain('contentSourceIds')
    expect(source).toContain(':popover-z-index="zIndex + 10"')
  })

  it('loads the full catalogue before grouping', () => {
    expect(source).toContain('const GROUPED_PAGE_SIZE = 500')
    expect(source).toContain('while (lastPageSize === pageSize)')
  })
})
