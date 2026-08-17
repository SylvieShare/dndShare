import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./GameContextSelector.vue', import.meta.url)), 'utf8')

describe('game context selector', () => {
  it('offers separate accessible system and edition controls', () => {
    expect(source).toContain('aria-label="Игровая система"')
    expect(source).toContain('aria-label="Редакция правил"')
    expect(source).toContain(':aria-expanded="open"')
    expect(source).toContain('store.selectSource(sourceID)')
    expect(source).toContain('store.selectVersion(sourceVersionID)')
  })

  it('keeps the current context compact and opens detailed selectors on demand', () => {
    expect(source).toContain('class="game-context-trigger-current"')
    expect(source).toContain('class="game-context-trigger-edition"')
    expect(source).toContain('<div v-if="open" class="game-context-panel game-context-panel--popover"')
    expect(source).not.toContain('v-if="!compact || open"')
    expect(source).toMatch(/\.game-context-trigger-edition \{[\s\S]*color: var\(--text-muted\);/)
  })
})
