import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./ViewCreateCharacter.vue', import.meta.url)), 'utf8')

describe('character creation workspace width', () => {
  it('gives the central wizard column more room without widening the step rail', () => {
    expect(source).toContain('--cc-main-max: 1120px;')
    expect(source).toContain('grid-template-columns: 220px minmax(0, var(--cc-main-max));')
  })
})
