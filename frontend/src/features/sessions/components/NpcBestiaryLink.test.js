import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = path => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8')
const npcEditor = read('./NpcEditorModal.vue')
const npcCanvasPreview = read('./SceneEntityBlockPreview.vue')

describe('prepared NPC bestiary link', () => {
  it('selects and clears an existing bestiary creature in the NPC editor', () => {
    expect(npcEditor).toContain('<ItemPickerModal')
    expect(npcEditor).toContain(':item-type-ids="[6]"')
    expect(npcEditor).toContain('bestiaryItemId: Number(draft.bestiaryItemId) || null')
    expect(npcEditor).toContain('Убрать привязку к бестиарию')
  })

  it('opens the linked creature from the NPC canvas card', () => {
    expect(npcCanvasPreview).toContain('Открыть в бестиарии')
    expect(npcCanvasPreview).toContain("router.push({ path: '/handbook', query: { type: 6, item: entity.value.bestiaryItemId } })")
  })
})
