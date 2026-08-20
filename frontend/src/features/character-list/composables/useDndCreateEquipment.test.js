import { reactive } from 'vue'
import { describe, expect, it } from 'vitest'
import { useDndCreateEquipment } from './useDndCreateEquipment'

function wizardState() {
  return reactive({
    buyStartingEquipment: false,
    charClass: null,
    classEquipmentChoices: {},
    equipment: [],
    startingShopCart: [],
    startingWealthRoll: null,
  })
}

describe('class equipment branch switching', () => {
  it('drops concrete picks when another column is selected', () => {
    const state = wizardState()
    state.classEquipmentChoices.weapon = {
      optionId: 'martial',
      picks: { weapon: ['longsword'] },
    }
    const equipment = useDndCreateEquipment({ state, sourceSuffix: () => '' })

    equipment.selectEquipmentOption('weapon', 'greataxe')

    expect(state.classEquipmentChoices.weapon).toEqual({ optionId: 'greataxe', picks: {} })
  })

  it('selects a visible inactive column and replaces its previous picks', () => {
    const state = wizardState()
    state.classEquipmentChoices.weapons = {
      optionId: 'shield',
      picks: { weapons: ['warhammer'] },
    }
    const equipment = useDndCreateEquipment({ state, sourceSuffix: () => '' })

    equipment.setEquipmentPick('weapons', 'two', 'weapons', 0, 'longsword')

    expect(state.classEquipmentChoices.weapons).toEqual({
      optionId: 'two',
      picks: { weapons: ['longsword'] },
    })
  })
})
