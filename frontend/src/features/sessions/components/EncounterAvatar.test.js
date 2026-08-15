import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('./EncounterAvatar.vue', import.meta.url)),
  'utf8',
)

function cssRule(selector) {
  return source.match(new RegExp(`${selector} \\{([^}]*)\\}`))?.[1] || ''
}

describe('EncounterAvatar', () => {
  it('stretches NPC artwork across the combat tile while preserving player portraits', () => {
    const npcRule = cssRule('\\.enc-avatar--npc')
    const playerRule = cssRule('\\.enc-avatar--player')

    expect(npcRule).toContain('align-self: stretch;')
    expect(npcRule).toContain('margin-block: -10px;')
    expect(npcRule).not.toMatch(/\\bheight\s*:/)
    expect(playerRule).toContain('width: 62px;')
    expect(playerRule).toContain('height: 62px;')
    expect(playerRule).toContain('border-radius: 50%;')
    expect(source).toContain('object-fit: cover;')
  })
})
