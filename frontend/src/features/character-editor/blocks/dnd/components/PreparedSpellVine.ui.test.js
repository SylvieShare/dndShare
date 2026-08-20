import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./PreparedSpellVine.vue', import.meta.url)), 'utf8')

describe('prepared spell vine artwork', () => {
  it('uses separate generated monochrome masks for both preparation states', () => {
    expect(source).toContain("url('/static/spells/prepared-vine.png')")
    expect(source).toContain("url('/static/spells/permanent-vine.png')")
    expect(source).toContain('mask-size: contain')
    expect(source).toContain('prepared-spell-bracket::after')
    expect(source).toContain('linear-gradient(to right')
    expect(source).toContain('prepared-spell-ornament-left')
    expect(source).toContain('prepared-spell-ornament-right')
    expect(source).not.toContain('<svg')
  })
})
