import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { DND_ALIGNMENTS, normalizeDndAlignment } from '@/shared/lib/dndAlignment'

const pickerSource = readFileSync(fileURLToPath(new URL('./DndAlignmentPicker.vue', import.meta.url)), 'utf8')
const personaSource = readFileSync(fileURLToPath(new URL('../../features/character-list/components/wizard/steps/StepPersona.vue', import.meta.url)), 'utf8')

describe('D&D alignment picker', () => {
  it('exposes the fixed nine-value enum in a three by three picker', () => {
    expect(DND_ALIGNMENTS).toHaveLength(9)
    expect(new Set(DND_ALIGNMENTS).size).toBe(9)
    expect(pickerSource).toContain('grid-template-columns: repeat(3')
    expect(normalizeDndAlignment('Нейтральный')).toBe('Нейтральный')
    expect(normalizeDndAlignment('свой вариант')).toBe('')
  })

  it('uses the same picker in the creation wizard', () => {
    expect(personaSource).toContain('<DndAlignmentPicker v-model="p.alignment"')
    expect(personaSource).not.toContain('<FormSelect')
  })
})
