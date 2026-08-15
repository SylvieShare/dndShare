import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ViewAdmin.vue', import.meta.url)), 'utf8')

describe('admin navigation shell', () => {
  it('keeps query-backed tabs accessible and switches to a compact mobile scroller', () => {
    expect(source).toContain('role="tablist"')
    expect(source).toContain('role="tab"')
    expect(source).toContain(':aria-selected="activeTab === tab.id"')
    expect(source).toContain('@keydown="onTabKeydown($event, index)"')
    expect(source).toContain("router.push({ query })")
    expect(source).toContain('@media (max-width: 760px)')
    expect(source).toContain('position: sticky;')
    expect(source).toContain('overflow-x: auto;')
    expect(source).toContain('width: 100%;')
  })
})
