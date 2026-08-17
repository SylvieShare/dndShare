import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const modalSource = readFileSync(fileURLToPath(new URL('./RichDiceNodeModal.vue', import.meta.url)), 'utf8')

describe('RichDiceNodeModal', () => {
  it('edits an optional manual average inside the dice payload', () => {
    expect(modalSource).toContain('label="Среднее значение"')
    expect(modalSource).toContain("props.node?.payload?.average")
    expect(modalSource).toContain("{ average: cleanAverage }")
    expect(modalSource).toContain('cleanAverage == null ? cleanFormula')
    expect(modalSource).toContain('`${cleanFormula} или ${cleanAverage}`')
    expect(modalSource).toContain('class="rdm-or"')
  })
})
