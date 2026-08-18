import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndLvlEditor.vue', import.meta.url)), 'utf8')

describe('level up action', () => {
  it('is absent until the character has enough experience', () => {
    expect(source).toContain('v-if="canLevelUp"')
    expect(source).not.toContain('v-if="level < 20"')
  })
})
