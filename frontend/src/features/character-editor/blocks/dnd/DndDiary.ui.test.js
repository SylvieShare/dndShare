import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const diarySource = read('./DndDiary.vue')
const cardSource = read('./components/DndDiarySessionCard.vue')
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
})
