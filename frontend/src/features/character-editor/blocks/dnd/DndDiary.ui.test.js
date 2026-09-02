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
    expect(workspaceSource).toContain('journal-source-select')
    expect(workspaceSource).toContain('Создать дневник кампании')
    expect(workspaceStyles).toContain('.journal-cover')
    expect(workspaceStyles).toContain('linear-gradient')
    expect(eventRowSource).toMatch(/\.der-node \{[\s\S]*?width: 26px;[\s\S]*?height: 26px;/)
  })
})
