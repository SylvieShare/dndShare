import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./HeaderSearch.vue', import.meta.url)), 'utf8')

describe('global header search', () => {
  it('uses the concise handbook placeholder', () => {
    expect(source).toContain('placeholder="Поиск по справочнику"')
    expect(source).not.toContain('placeholder="Поиск по справочнику и правилам..."')
  })
})
