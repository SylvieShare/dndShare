import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndCharIdentity.vue', import.meta.url)), 'utf8')

describe('character identity summary', () => {
  it('keeps the name visible on the regular summary surface', () => {
    expect(source).toContain("props.block.content?.name_color || 'var(--text-1)'")
  })

  it('renders classes on a separate, width-bounded ellipsis row', () => {
    expect(source).toContain('<div class="dci-main-row">')
    expect(source).toContain('<span v-if="classPart" class="dci-classes" :title="classPart">{{ classPart }}</span>')
    expect(source).toMatch(/\.dci-classes \{[^}]*max-width: 100%;[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;[^}]*white-space: nowrap;/)
  })
})
