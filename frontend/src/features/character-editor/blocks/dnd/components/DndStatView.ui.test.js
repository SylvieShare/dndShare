import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./DndStatView.vue', import.meta.url)), 'utf8')

describe('DndStatView presentation', () => {
  it('labels the saving throw without the shield icon', () => {
    expect(source).toContain('<span class="save-label">спас</span>')
    expect(source).not.toContain('save-shield-icon')
  })

  it('opens the skill bonus breakdown after a short hover delay', () => {
    expect(source).toContain('const TOOLTIP_DELAY_MS = 450')
    expect(source).toContain('@mouseenter="showTooltip($event, skill)"')
    expect(source).toContain('bonuses: skill.bonusDetails || []')
    expect(source).toContain('onBeforeUnmount(hideTooltip)')
  })

  it('right-aligns bonus titles against a fixed numeric column', () => {
    expect(source).toContain('grid-template-columns: minmax(0, 1fr) 3.25ch')
    expect(source).toContain('column-gap: 12px')
    expect(source).toContain('margin-left: auto')
    expect(source).toContain('text-align: right')
  })
})
