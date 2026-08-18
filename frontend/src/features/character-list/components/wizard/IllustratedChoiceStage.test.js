import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./IllustratedChoiceStage.vue', import.meta.url)), 'utf8')

describe('illustrated choice stage', () => {
  it('keeps the back action over the selected card media area', () => {
    expect(source).toContain('class="illustrated-choice-stage"')
    expect(source).toContain('class="illustrated-choice-back"')
    expect(source).toContain('top: 10px; left: 10px')
  })

  it('owns shared selection motion and scroll restoration', () => {
    expect(source).toContain('name="illustrated-list"')
    expect(source).toContain("scroller.scrollTo({ top: scrollTop, behavior: 'auto' })")
  })

  it('supports a responsive two-column catalogue that collapses after selection', () => {
    expect(source).toContain("'illustrated-choice-list--two-column': twoColumn && !selected")
    expect(source).toContain('.illustrated-choice-list--two-column { grid-template-columns: repeat(2, minmax(0, 1fr)); }')
    expect(source).toContain('@media (max-width: 700px)')
  })
})
