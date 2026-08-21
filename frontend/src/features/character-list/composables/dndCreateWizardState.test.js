import { describe, expect, it } from 'vitest'
import {
  DND_WIZARD_FLOW_VERSION,
  createDndWizardState,
  normalizeDndWizardDraft,
  serializeDndWizardState,
} from './dndCreateWizardState'

describe('D&D creation wizard state', () => {
  it('moves old drafts back after removing the equipment and review steps', () => {
    expect(normalizeDndWizardDraft({ step: 6, buyStartingEquipment: false }).step).toBe(5)
    expect(normalizeDndWizardDraft({ step: 7, buyStartingEquipment: false }).step).toBe(5)
  })

  it('keeps the old equipment position as the next persona step', () => {
    expect(normalizeDndWizardDraft({ step: 5, buyStartingEquipment: false }).step).toBe(5)
  })

  it('keeps the optional shop position and clamps migrated drafts to persona', () => {
    expect(normalizeDndWizardDraft({ step: 6, buyStartingEquipment: true }).step).toBe(6)
    expect(normalizeDndWizardDraft({ flowVersion: DND_WIZARD_FLOW_VERSION, step: 6, buyStartingEquipment: false }).step).toBe(5)
  })

  it('persists the current flow version', () => {
    expect(serializeDndWizardState(createDndWizardState()).flowVersion).toBe(DND_WIZARD_FLOW_VERSION)
  })

  it('persists concrete class tool proficiency choices', () => {
    const state = createDndWizardState()
    state.classToolProficiencyIds = [319, 322, 326]
    expect(serializeDndWizardState(state).classToolProficiencyIds).toEqual([319, 322, 326])
  })

  it('keeps uploaded persona media in the draft', () => {
    const state = createDndWizardState()
    state.persona.portrait = { url: '/portrait.webp', upload_id: 41 }
    state.persona.icon = { url: '/icon.webp', upload_id: 42 }
    expect(serializeDndWizardState(state).persona).toMatchObject({
      portrait: { upload_id: 41 },
      icon: { upload_id: 42 },
    })
  })
})
