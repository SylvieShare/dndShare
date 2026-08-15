import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RowActionSubmenu } from '@sylvieshare/share-ui'
const participantSource = readFileSync(fileURLToPath(new URL('../../features/sessions/components/SessionParticipantCard.vue', import.meta.url)), 'utf8')
const encounterSource = readFileSync(fileURLToPath(new URL('../../features/sessions/components/EncounterRowMenu.vue', import.meta.url)), 'utf8')
const spellSource = readFileSync(fileURLToPath(new URL('../../features/character-editor/blocks/dnd/components/SpellCard.vue', import.meta.url)), 'utf8')
const chapterSource = readFileSync(fileURLToPath(new URL('../../features/sessions/components/ChapterGraphTab.vue', import.meta.url)), 'utf8')

describe('RowActionSubmenu', () => {
  it('compiles the shared nested action component', () => {
    expect(RowActionSubmenu).toBeTruthy()
  })

  it('replaces every action-menu inline choice with the shared submenu', () => {
    expect(participantSource).toContain('<RowActionSubmenu v-if="isDm" label="Цвет игрока"')
    expect(encounterSource.match(/<RowActionSubmenu/g)).toHaveLength(1)
    expect(encounterSource).not.toContain('ColorPresetPicker')
    expect(spellSource).toContain('<RowActionSubmenu')
    expect(spellSource).not.toContain('choosingSlot')
    expect(chapterSource.match(/<RowActionSubmenu/g)).toHaveLength(2)
    expect(chapterSource).not.toContain('statusOpen')
    expect(chapterSource).not.toContain('moveOpen')
    expect([participantSource, encounterSource].join('\n')).not.toContain('ram-colors')
  })
})
