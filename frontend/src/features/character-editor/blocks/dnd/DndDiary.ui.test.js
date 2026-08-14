import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const diarySource = read('./DndDiary.vue')
const cardSource = read('./components/DndDiarySessionCard.vue')
const eventRowSource = read('./components/DndDiaryEventRow.vue')
const modalSource = read('./components/DndDiarySessionModal.vue')

describe('D&D diary UI flows', () => {
  it('uses the regular modal for session editing while events retain morph editing', () => {
    expect(diarySource).toMatch(/<DndDiarySessionModal[\s\S]*?editorKind === 'session'/)
    expect(diarySource).toMatch(/<MorphEditorShell[\s\S]*?editorKind === 'event'/)
    expect(modalSource).toContain('<AppModalFrame')
  })

  it('animates expanding session content and disables that motion when requested', () => {
    expect(cardSource).toContain('<Transition name="dsc-expand">')
    expect(cardSource).toMatch(/grid-template-rows: 0fr/)
    expect(cardSource).toMatch(/@media \(prefers-reduced-motion: reduce\)/)
  })

  it('keeps the morph event preview on the session timeline rail', () => {
    expect(diarySource).toMatch(/<span v-if="currentEvent\.type !== 'newday'" class="dd-event-rail"/)
    expect(diarySource).toMatch(/\.dd-event-face \{\s*position: relative;\s*padding: 12px 16px;/)
    expect(diarySource).toMatch(/\.dd-event-rail \{[\s\S]*?left: 28px;[\s\S]*?width: 2px;/)
    expect(diarySource).toContain('<path d="M2 5.5 6 1.5l4 4M6 2v8.5" />')
    expect(eventRowSource).toMatch(/\.der-node \{[\s\S]*?width: 26px;[\s\S]*?height: 26px;/)
  })
})
