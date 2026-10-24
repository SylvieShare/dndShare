import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(
  fileURLToPath(new URL('./EncounterAvatar.vue', import.meta.url)),
  'utf8',
)

describe('EncounterAvatar', () => {
  it('delegates portrait and icon geometry to the common avatar', () => {
    expect(source).toContain('<SessionCreatureAvatar')
    expect(source).toContain(':icon="!isPlayer || isPlayerIcon"')
    expect(source).toContain('enc.findParticipant(props.combatant.charId)?.iconImageUrl')
  })
})
