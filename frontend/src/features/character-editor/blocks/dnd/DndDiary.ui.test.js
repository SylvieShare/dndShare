import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const diarySource = read('./DndDiary.vue')
const workspaceSource = read('../../../journals/components/JournalWorkspace.vue')
const workspaceStyles = read('../../../journals/components/JournalWorkspace.css')
const cardSource = read('./components/DndDiarySessionCard.vue')
const eventRowSource = read('./components/DndDiaryEventRow.vue')
const modalSource = read('./components/DndDiarySessionModal.vue')

describe('D&D diary UI flows', () => {
  it('uses one API-backed workspace on character and session pages', () => {
    expect(diarySource).toContain('<JournalWorkspace')
    expect(workspaceSource).toContain('characterUuid')
    expect(workspaceSource).toContain('sessionUuid')
    expect(workspaceSource).toMatch(/<DndDiarySessionModal[\s\S]*?editorKind === 'section'/)
    expect(workspaceSource).toMatch(/<MorphEditorShell[\s\S]*?editorKind === 'event'/)
    expect(modalSource).toContain('<AppModalFrame')
  })

  it('animates expanding session content and disables that motion when requested', () => {
    expect(cardSource).toContain('<Transition name="dsc-expand">')
    expect(cardSource).toMatch(/grid-template-rows: 0fr/)
    expect(cardSource).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })

  it('presents source selection and a distinct journal cover', () => {
    expect(workspaceSource).toContain('<JournalSourceSwitch')
    expect(workspaceSource).not.toContain('journal-new-personal')
    expect(workspaceSource).not.toContain('structuredClone')
    expect(workspaceSource).toContain('Создать дневник кампании')
    expect(workspaceStyles).toContain('.journal-cover')
    expect(workspaceStyles).toContain('linear-gradient')
    expect(eventRowSource).toMatch(/\.der-node \{[\s\S]*?width: 44px;[\s\S]*?height: 44px;/)
  })

  it('keeps event creation above the upward timeline and uses shared sorting', () => {
    expect(cardSource.indexOf('Добавить событие')).toBeLessThan(cardSource.indexOf('class="dsc-events"'))
    expect(cardSource).toContain('useSortable')
    expect(cardSource).toContain('@keydown.up.prevent')
    expect(cardSource).toContain(".map(e => e.id).reverse()")
    expect(cardSource).toContain('dragSnapshot === eventKey()')
  })

  it('shares scenario speaker colors and makes existing event types read-only', () => {
    expect(eventRowSource).toContain('hydrateDialogueRows')
    expect(eventRowSource).toContain('--speaker-color')
    const editor = read('./components/DndDiaryEventEditor.vue')
    expect(editor).toMatch(/<MultiToggle[\s\S]*?v-if="mode === 'create'"/)
    expect(editor).toContain('Тип сохранённого события')
    expect(workspaceSource).toContain('v-if="sessionUuid && canManage && journal.kind === \'session\'"')
    expect(workspaceSource).toContain('Игроки могут редактировать дневник')
  })

  it('keeps settings inside the session cover and metadata at the event footer', () => {
    const cover = workspaceSource.match(/<header class="journal-cover">[\s\S]*?<\/header>/)[0]
    expect(cover).toContain('<ToggleSwitch')
    expect(workspaceSource).not.toContain('class="journal-access"')
    expect(eventRowSource).not.toContain('der-kind')
    expect(eventRowSource).not.toContain('speakersCount')
    expect(eventRowSource).not.toContain('combatantCount')
    expect(eventRowSource).not.toContain('НОВЫЙ ДЕНЬ')
    expect(eventRowSource.match(/<DndDiaryEventMetadata/g)).toHaveLength(2)
    const metadata = read('./components/DndDiaryEventMetadata.vue')
    expect(metadata).toContain('<footer')
    expect(metadata).toContain('justify-content: flex-end')
    expect(metadata).toContain('<ItemTooltip')
    expect(metadata).toContain('@focus=')
    expect(metadata).toContain('@click.stop')
  })
})
