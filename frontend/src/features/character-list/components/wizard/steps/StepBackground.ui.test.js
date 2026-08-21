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

  it('renders every tool proficiency and text-only equipment grant as a shared tile', () => {
    expect(source).toContain('<BaseTile')
    expect(source).toContain('v-for="toolName in backgroundToolNames"')
    expect(source).toContain('v-for="(entry, entryIndex) in backgroundStart.items"')
    expect(source).toContain('<Hammer')
    expect(source).toContain('<Backpack')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('@media (max-width: 640px)')
  })
})
