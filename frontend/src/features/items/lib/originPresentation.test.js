import { describe, expect, it } from 'vitest'
import { subclassGrantedSpellMetric, subclassSpellcastingLabel } from './originPresentation'

describe('origin presentation', () => {
  it('inherits subclass spellcasting unless the subclass defines its own progression', () => {
    expect(subclassSpellcastingLabel({})).toBe('По правилам класса')
    expect(subclassSpellcastingLabel({ caster_progression: 'third' })).toBe('Треть')
  })

  it('counts mutually exclusive spell options instead of every option row', () => {
    expect(subclassGrantedSpellMetric({ granted_spells: [{ spell: 1 }, { spell: 2 }] }))
      .toEqual({ value: 2, label: 'даров.', summary: 'Дарованных заклинаний: 2' })
    expect(subclassGrantedSpellMetric({ granted_spells: [
      { spell: 1, option: 'Арктика' },
      { spell: 2, option: 'Арктика' },
      { spell: 3, option: 'Лес' },
    ] })).toEqual({ value: 2, label: 'вариант.', summary: 'Вариантов заклинаний: 2' })
  })
})
