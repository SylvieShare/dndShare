import { createPinia, setActivePinia } from 'pinia'
import { describe, expect, it } from 'vitest'
import { costError, costAmountLabel, costRangeLabel } from './itemCost'
import { useCostFormatter } from './useCostFormatter'
import { useSuggestStore } from '@/stores/suggest'
import { catalogueValidation } from '../editor/catalogue/catalogueValidation'
import { normalizeDataForSave } from '@/features/handbook/objects/lib/schemaFields'
import { itemCostCopper } from '@/features/character-editor/settings/dnd/creation/startingShop'

const fields = [{ key: 'cost', name: 'Стоимость', type: 'int_by_suggest', allow_range: true, suggest_type_id: 17 }]
describe('shared item cost', () => {
  it.each([
    [{ value: 250, suggest_id: 3 }, '250 зм', 25000],
    [{ min: 101, max: 500, suggest_id: 3 }, '101–500 зм', null],
    [{ value: 250, min: 101, max: 500, suggest_id: 3 }, '250 зм · диапазон 101–500 зм', 25000],
    [{ value: 0, min: 0, max: 10, suggest_id: 2 }, '0 см · диапазон 0–10 см', 0],
  ])('keeps exact and range prices independent: %o', (cost, label, purchase) => {
    setActivePinia(createPinia())
    useSuggestStore().set(17, [{ id: 3, value: 'Золотые монеты', code: 'зм' }, { id: 2, code: 'см' }])
    expect(costError(cost)).toBe('')
    expect(useCostFormatter().format(cost)).toBe(label)
    expect(itemCostCopper({ data: { cost } })).toBe(purchase)
    expect(normalizeDataForSave({ cost }, fields).cost).toEqual(cost)
    for (const type of [1, 2, 10, 12, 13, 14, 19]) expect(catalogueValidation(fields, { cost }, type)).toEqual([])
  })
  it.each([{ min: 500, max: 101, suggest_id: 3 }, { min: 101, suggest_id: 3 }, { min: 101, max: 500 }, { value: -1, suggest_id: 3 }, { value: 'oops', suggest_id: 3 }])('rejects incomplete or invalid prices: %o', cost => {
    expect(costError(cost)).not.toBe('')
    expect(catalogueValidation(fields, { cost }, 19)).not.toEqual([])
  })
  it('does not interpret missing prices or a lone currency as free', () => {
    expect(costAmountLabel({ value: null, suggest_id: 3 })).toBe('')
    expect(itemCostCopper({ data: { cost: { value: null, suggest_id: 3 } } })).toBeNull()
    expect(costRangeLabel({ min: 500, max: 101 })).toBe('')
  })
  it('requires an exact shop price while allowing the range to remain', () => {
    expect(catalogueValidation(fields, { cost: { min: 101, max: 500, suggest_id: 3 }, available_in_starting_shop: true }, 19)).toContain('Для продажи при создании персонажа укажите точную цену.')
    expect(catalogueValidation(fields, { cost: { value: 250, min: 101, max: 500, suggest_id: 3 }, available_in_starting_shop: true }, 19)).toEqual([])
  })
})
