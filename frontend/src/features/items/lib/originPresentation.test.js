import { describe, expect, it } from 'vitest'
import { subclassSpellcastingLabel } from './originPresentation'

describe('origin presentation', () => {
  it('inherits subclass spellcasting unless the subclass defines its own progression', () => {
    expect(subclassSpellcastingLabel({})).toBe('По правилам класса')
    expect(subclassSpellcastingLabel({ caster_progression: 'third' })).toBe('Треть')
  })
})
