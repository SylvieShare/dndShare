import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ValueSelect.vue', import.meta.url)), 'utf8')

describe('ValueSelect placement', () => {
  it('keeps the usual dropdown direction unless dropUp is explicitly requested', () => {
    expect(source).toContain("dropUp: { type: Boolean, default: false }")
    expect(source).toContain(":class=\"{ 'vs-drop-up': dropUp }\"")
    expect(source).toMatch(/\.vs-drop-up\s*\{\s*top: auto;\s*bottom: calc\(100% \+ 4px\);/)
  })
})
