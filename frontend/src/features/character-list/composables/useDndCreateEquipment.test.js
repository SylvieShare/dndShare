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
  it('buys and removes complete packages while persisting piece counts and charging once', () => {
    const state = wizardState()
    state.buyStartingEquipment = true
    state.startingWealthRoll = { gold: 2 }
    const equipment = useDndCreateEquipment({ state, sourceSuffix: () => '' })
    const arrows = { id: 347, typeId: 2, name: 'Стрела', data: { purchase_quantity: 20, cost: { value: 1, suggest_id: 3 } } }
    equipment.addShopItem(arrows)
    expect(state.startingShopCart[0].count).toBe(20)
    expect(equipment.shopSpentCopper.value).toBe(100)
    expect(equipment.allEquipment.value[0].count).toBe(20)
    equipment.bumpShopItem(state.startingShopCart[0], 1)
    expect(state.startingShopCart[0].count).toBe(40)
    expect(equipment.shopRemainingCopper.value).toBe(0)
    equipment.addShopItem(arrows)
    expect(state.startingShopCart[0].count).toBe(40)
    equipment.bumpShopItem(state.startingShopCart[0], -1)
    expect(state.startingShopCart[0].count).toBe(20)
    expect(equipment.shopSpentCopper.value).toBe(100)
    equipment.bumpShopItem(state.startingShopCart[0], -1)
    expect(state.startingShopCart).toEqual([])
  })
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

  it('updates only the matching parameterized instance', () => {
    const state = wizardState()
    state.equipment = [
      { item_id: 42, count: 1, params: { length_ft: 25 } },
      { item_id: 42, count: 2, params: { length_ft: 50 } },
    ]
    const equipment = useDndCreateEquipment({ state, sourceSuffix: () => '' })

    equipment.bumpEquipment(state.equipment[1], 1)
    equipment.removeEquipment(state.equipment[0])

    expect(state.equipment).toEqual([
      { item_id: 42, count: 3, params: { length_ft: 50 } },
    ])
  })
})
