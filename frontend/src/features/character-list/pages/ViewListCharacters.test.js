import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ViewListCharacters.vue', import.meta.url)), 'utf8')

describe('character list lifecycle', () => {
  it('refreshes the cached list when returning from character creation', () => {
    expect(source).toContain('onActivated(() =>')
    expect(source).toContain('loadChars(consumePrefetch(route.fullPath))')
  })
})
