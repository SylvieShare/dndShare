import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndCreateCharacterWorkspace.vue', import.meta.url)), 'utf8')

const layout = readFileSync(new URL('../components/wizard/creationWorkspace.css', import.meta.url), 'utf8')

describe('character creation workspace width', () => {
  it('gives the central wizard column more room without widening the step rail', () => {
    expect(source).toContain('<WizardFrame')
    expect(layout).toContain('220px minmax(0, 1120px)')
  })

  it('keeps responsive scrolling inside the wizard workspace', () => {
    expect(layout).toContain('overflow-y: auto;')
    expect(layout).toContain('overscroll-behavior-y: contain;')
    expect(layout).toContain('scrollbar-gutter: stable;')
    expect(layout).toContain('height: calc(100dvh - var(--header-h));')
    expect(layout).not.toContain('.cc { height: auto;')
  })

  it('moves reset into the step rail and exposes incomplete creation outside the final step', () => {
    expect(source).toContain('@reset="resetOpen = true"')
    expect(source).toContain('@create-incomplete="createIncomplete"')
    expect(source).toContain(':show-incomplete="!isFullyValid"')
    expect(source).not.toContain('class="btn reset"')
    expect(source).toContain('confirmOpen.value = true')
  })

  it('requires every non-zero class spell pick before leaving the class step', () => {
    expect(source).toContain('cantripChosen.value !== cantripLimit.value')
    expect(source).toContain('`Заговоры: ${cantripChosen.value} из ${cantripLimit.value}`')
    expect(source).toContain('spell1Chosen.value !== spell1Limit.value')
    expect(source).toContain('`Заклинания 1 круга: ${spell1Chosen.value} из ${spell1Limit.value}`')
  })

  it('requires all choices owned by the selected background', () => {
    expect(source).toContain('!backgroundItemChoicesComplete.value')
    expect(source).toContain("reason: 'Заверши выборы предыстории'")
  })

  it('skips the equipment step and inserts only the optional starting shop', () => {
    expect(source).not.toContain('StepEquipment')
    expect(source).not.toContain("key: 'equipment'")
    expect(source).toContain('...(state.buyStartingEquipment')
    expect(source).toContain("[{ key: 'shop', title: 'Магазин'")
  })

  it('finishes on persona and opens the assembled sheet as a read-only preview', () => {
    expect(source).not.toContain('StepReview')
    expect(source).not.toContain("key: 'review'")
    expect(source).toContain('Предпросмотр листа')
    expect(source).toContain('<CharacterSheetModal')
    expect(source).toContain(':draft="previewDraft"')
    expect(source).toContain('const payload = buildPayload()')
    expect(source).toContain('userId: null')
  })
})
