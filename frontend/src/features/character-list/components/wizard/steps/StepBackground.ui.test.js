import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepBackground.vue', import.meta.url)), 'utf8')

describe('background step presentation', () => {
  it('renders illustrated backgrounds in a two-column grid', () => {
    expect(source).toContain('<IllustratedChoiceStage')
    expect(source).toContain('back-text="К выбору предыстории"')
    expect(source).toContain('two-column')
    expect(source).toContain('<BackgroundSelectCard')
  })

  it('expands only the selected background and renders its details below', () => {
    expect(source).toContain('v-for="b in visibleBackgrounds"')
    expect(source).toContain('state.background ? [state.background] : bgPool.value')
    expect(source).toContain('<template #details>')
    expect(source).toContain('@clear="state.background = null"')
  })

  it('uses the dedicated cover and never stretches the compact icon', () => {
    expect(source).toContain(':image-url="b.coverImageUrl || \'\'"')
    expect(source).not.toContain('iconImageUrl')
  })

  it('renders canonical tool and equipment references that open handbook cards', () => {
    expect(source).toContain('<ItemReferenceRow')
    expect(source).toContain('v-for="item in backgroundToolItems"')
    expect(source).toContain('v-for="entry in backgroundStart.items"')
    expect(source).toContain('@activate="viewItem = { ...item, id: item.item_id }"')
    expect(source).toContain('@activate="viewItem = { ...entry, id: entry.item_id }"')
    expect(source).toContain('<ItemViewModal')
    expect(source).not.toContain('<BaseTile')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('@media (max-width: 640px)')
  })
})
