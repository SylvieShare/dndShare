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
    expect(source).toContain('<TransitionGroup name="illustrated-list"')
    expect(source).toContain("scroller.scrollTo({ top: scrollTop, behavior: 'auto' })")
  })
})
