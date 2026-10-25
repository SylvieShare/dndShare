import { expect, it } from 'vitest'
import { refreshDndWizardSelections } from './refreshDndWizardSelections'

it('refreshes selected class, subclass and background while retaining their choices', () => {
  const state = {
    charClass: { id: 1, data: { hit_die: 6 } }, subclass: { id: 2 }, background: { id: 3 },
    skillIds: [5], classEquipmentChoices: { weapon: ['sword'] }, backgroundItemChoices: { tool: 10 },
  }
  const current = { id: 1, data: { hit_die: 10, subclasses: [{ id: 2 }] } }
  const background = { id: 3, data: { feature: 'Current' } }
  expect(refreshDndWizardSelections(state, { races: [], subraces: [], classes: [current], subclasses: [{ id: 2 }], backgrounds: [background] })).toBe('')
  expect(state.charClass).toBe(current)
  expect(state.background).toBe(background)
  expect(state.skillIds).toEqual([5])
  expect(state.classEquipmentChoices).toEqual({ weapon: ['sword'] })
  expect(state.backgroundItemChoices).toEqual({ tool: 10 })
})

it('clears unavailable selections with an explanation', () => {
  const state = { charClass: { id: 1, name: 'Removed' }, subclass: null }
  expect(refreshDndWizardSelections(state, { races: [], subraces: [], classes: [], subclasses: [], backgrounds: [] })).toContain('Removed')
  expect(state.charClass).toBeNull()
})
