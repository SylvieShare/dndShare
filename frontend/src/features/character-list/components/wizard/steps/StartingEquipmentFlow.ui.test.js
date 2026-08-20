import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const read = name => readFileSync(fileURLToPath(new URL(`./${name}.vue`, import.meta.url)), 'utf8')

describe('starting equipment wizard flow', () => {
  it('uses handbook item rows for class options, fixed grants and any-item picks', () => {
    const source = read('StepClassEquipment')
    expect(source).toContain('Закупиться потом в магазине')
    expect(source).toContain('<ItemReferenceRow')
    expect(source).toContain('<EquipmentItemSelect')
    expect(source).toContain("'choice-options--paired': group.options.length === 2")
    expect(source).toContain('<ShieldCheck')
    expect(source).toContain(':placeholder="pickPlaceholder(pick, index)"')
    expect(source).not.toContain('<span>{{ pick.label }}')
    expect(source).toContain('Также получите')
    expect(source).toContain('<ItemViewModal')
  })

  it('offers the PHB wealth roll, five catalogues and a budgeted cart', () => {
    const source = read('StepStartingShop')
    expect(source).toContain('Начальное богатство')
    expect(source).toContain('startingWealthFormulaLabel')
    expect(source).toContain("{ id: 13, label: 'Транспорт' }")
    expect(source).toContain('canBuyShopItem(item)')
    expect(source).toContain('<ConfirmDialog')
    expect(source).toContain('Останется в кошельке')
  })
})
