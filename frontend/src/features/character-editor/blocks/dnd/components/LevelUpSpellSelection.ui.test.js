import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./LevelUpSpellSelection.vue', import.meta.url)), 'utf8')

describe('level-up spell selection', () => {
  it('supports adding, removing and replacing class spells through one source-bound selection', () => {
    expect(source).toContain('context.sourceKey')
    expect(source).toContain('inferUnassigned')
    expect(source).toContain('@click="remove(entry.id)"')
    expect(source).toContain('<ItemPickerModal')
    expect(source).toContain("'classes.id'")
  })
})
