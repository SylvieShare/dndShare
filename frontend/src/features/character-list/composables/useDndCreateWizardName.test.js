import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./useDndCreateWizard.js', import.meta.url)), 'utf8')

describe('D&D wizard random name integration', () => {
  it('uses the shared race-aware generator with the selected subrace first', () => {
    expect(source).toContain("import { randomDndName } from '@/shared/lib/dndNames'")
    expect(source).toContain('randomDndName(state.subrace || state.race, Math.random, state.name)')
    expect(source).not.toContain('NAME_POOL')
  })
})
