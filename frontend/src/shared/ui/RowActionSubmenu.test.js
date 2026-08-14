import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import RowActionSubmenu from './RowActionSubmenu.vue'

const source = readFileSync(fileURLToPath(new URL('./RowActionSubmenu.vue', import.meta.url)), 'utf8')
const menuSource = readFileSync(fileURLToPath(new URL('./RowActionMenu.vue', import.meta.url)), 'utf8')
const popoverSource = readFileSync(fileURLToPath(new URL('./BasePopover.vue', import.meta.url)), 'utf8')
const participantSource = readFileSync(fileURLToPath(new URL('../../features/sessions/components/SessionParticipantCard.vue', import.meta.url)), 'utf8')
const encounterSource = readFileSync(fileURLToPath(new URL('../../features/sessions/components/EncounterRowMenu.vue', import.meta.url)), 'utf8')
const spellSource = readFileSync(fileURLToPath(new URL('../../features/character-editor/blocks/dnd/components/SpellCard.vue', import.meta.url)), 'utf8')
const chapterSource = readFileSync(fileURLToPath(new URL('../../features/sessions/components/ChapterGraphMenus.vue', import.meta.url)), 'utf8')

describe('RowActionSubmenu', () => {
  it('compiles the shared nested action component', () => {
    expect(RowActionSubmenu).toBeTruthy()
  })

  it('uses a separate anchored popover on desktop', () => {
    expect(source).toContain('v-if="!isMobile"')
    expect(source).toContain('placement="right-start"')
    expect(source).toContain('popover-class="row-action-submenu-popover"')
  })

  it('expands inline with a left boundary on mobile', () => {
    expect(source).toContain('v-if="isMobile && isOpen"')
    expect(source).toContain('border-left: 2px solid var(--accent);')
  })

  it('keeps interaction with the nested popover inside the parent action menu', () => {
    expect(menuSource).toContain("closest?.('.ram-popover, .row-action-submenu-popover')")
    expect(popoverSource).toContain("closest?.('.row-action-submenu-popover')")
    expect(popoverSource).toContain("openPopovers.at(-1) !== popoverEl.value")
    expect(menuSource).toContain('if (closeOpenRowActionSubmenu()) return')
    expect(popoverSource).toContain('if (closeOpenRowActionSubmenu()) return')
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
