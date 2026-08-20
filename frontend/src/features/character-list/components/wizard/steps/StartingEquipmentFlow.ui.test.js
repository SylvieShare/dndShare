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
    expect(source).toContain('.choice-title::after')
    expect(source).toContain('.choice-options--paired .choice-option + .choice-option')
    expect(source).toContain('border-left: 1px solid var(--border)')
    expect(source).toContain('.choice-options:not(.choice-options--paired) .choice-option + .choice-option')
    expect(source).toContain('border-top: 1px solid var(--border)')
    const optionRule = source.match(/\.choice-option \{([^}]*)\}/)?.[1] || ''
    expect(optionRule).not.toContain('background:')
    expect(optionRule).not.toContain('border-radius:')
    expect(source).toContain('v-if="entry.picks?.length"')
    expect(source).not.toContain('optionSelected(group, entry) && entry.picks')
    expect(source).toContain('pickValue(group.id, entry.id, pick.id, index - 1)')
    expect(source).toContain('choice?.optionId !== optionId')
    expect(source).toContain(':selected="optionSelected(group, entry)"')
    expect(source).toContain('@activate="selectOptionFromItem(group, entry)"')
    expect(source).toContain('@details="viewItem = linked.item"')
    expect(source).toContain('if (!optionSelected(group, entry)) selectEquipmentOption(group.id, entry.id)')
    expect(source).toMatch(/:count="entry\.count"\s+selected/)
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
