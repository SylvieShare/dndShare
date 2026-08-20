import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./PreparedSpellBrackets.vue', import.meta.url)), 'utf8')

describe('prepared spell side brackets', () => {
  it('uses compact rounded brackets without background artwork or fading arms', () => {
    expect(source).toContain('prepared-spell-bracket-left')
    expect(source).toContain('prepared-spell-bracket-right')
    expect(source).toContain('border-radius: 11px 0 0 11px')
    expect(source).toContain('border-left-width: 2px')
    expect(source).toContain('border-left-width: 3px')
    expect(source).not.toContain('prepared-spell-bracket::after')
    expect(source).not.toContain('url(')
    expect(source).not.toContain('linear-gradient')
  })
})
