import { describe, expect, it } from 'vitest'
import { createDndWizardState } from './dndCreateWizardState'
import { buildDndCharacterPayload } from './dndCreateWizardPayload'

function build(state) {
  return buildDndCharacterPayload({
    state,
    stats: ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'],
    spellPool: [],
    grantedSpellList: [],
    featPool: [],
    equipment: [],
    backgroundEquipment: { items: [], coins: {} },
    backgroundToolProficiencies: [],
    buyStartingEquipment: false,
    startingWallet: {},
    grantedSpellIds: [],
    featureChoices: [],
    raceAbilities: [],
    classAbilities: [],
    suggestValue: () => '',
    isExpertiseChoice: () => false,
  })
}

describe('D&D wizard payload media', () => {
  it('submits a staged character icon outside the sheet JSON', () => {
    const state = createDndWizardState()
    state.persona.icon = { url: '/icon.webp', upload_id: 77 }

    const payload = build(state)

    expect(payload.iconImageUploadId).toBe(77)
    expect(payload.data.values.icon).toBeUndefined()
  })

  it('does not submit an icon reference when none was uploaded', () => {
    expect(build(createDndWizardState())).not.toHaveProperty('iconImageUploadId')
  })
})
