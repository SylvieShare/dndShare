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
})
