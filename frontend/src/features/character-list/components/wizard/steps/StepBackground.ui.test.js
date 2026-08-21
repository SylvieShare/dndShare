import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(fileURLToPath(new URL('./StepBackground.vue', import.meta.url)), 'utf8')
const itemReference = readFileSync(fileURLToPath(new URL('../../../../items/components/ItemReferenceRow.vue', import.meta.url)), 'utf8')
const equipmentSelect = readFileSync(fileURLToPath(new URL('../EquipmentItemSelect.vue', import.meta.url)), 'utf8')

describe('background step presentation', () => {
  it('has one element root so wizard transitions can remount the selected step', () => {
    expect(source).toMatch(/<template>\s*<div class="step">/)
    expect(source).toContain(':loading="loading && !bgPool.length && !state.background"')
    expect(source).toContain(':empty="!loading && !bgPool.length && !state.background"')
  })

  it('renders illustrated backgrounds in a two-column grid', () => {
    expect(source).toContain('<IllustratedChoiceStage')
    expect(source).toContain('back-text="К выбору предыстории"')
    expect(source).toContain('two-column')
    expect(source).toContain('<BackgroundSelectCard')
  })

  it('expands only the selected background and renders its details below', () => {
    expect(source).toContain('v-for="b in visibleBackgrounds"')
    expect(source).toContain('state.background ? [state.background] : bgPool.value')
    expect(source).toContain('<template #details>')
    expect(source).toContain('@clear="state.background = null"')
  })

  it('uses the dedicated cover and never stretches the compact icon', () => {
    expect(source).toContain(':image-url="b.coverImageUrl || \'\'"')
    expect(source).not.toContain('iconImageUrl')
  })

  it('renders canonical tool and equipment references that open handbook cards', () => {
    expect(source).toContain('<ItemReferenceRow')
    expect(source).toContain('v-for="item in displayedBackgroundToolItems"')
    expect(source).toContain('v-for="entry in backgroundWeaponItems"')
    expect(source).toContain('v-for="entry in backgroundOtherItems"')
    expect(source).toContain('Number(entry.typeId) === 1')
    expect(source).toContain('Number(entry.typeId) !== 1')
    expect(source).toContain('grant-tiles--weapons')
    expect(source).toContain('grant-tiles--equipment')
    expect(source).toContain('Остальное снаряжение')
    expect(source).toContain('@activate="viewItem = { ...item, id: item.item_id }"')
    expect(source).toContain('@activate="viewItem = { ...entry, id: entry.item_id }"')
    expect(source).toContain('roomy-weapon')
    expect(source).toContain('compact-side')
    expect(source).toContain('show-details')
    expect(source).toContain('<ItemViewModal')
    expect(source).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))')
    expect(source).toContain('align-items: start')
    expect(source).toContain('@media (max-width: 640px)')
  })

  it('uses compact multi-line item rows with a stacked details, cost and weight rail', () => {
    expect(equipmentSelect).toContain(':compact-side="compactSide"')
    expect(itemReference).toContain("'item-reference--compact-side': compactSide")
    expect(itemReference).toContain('class="item-reference-side"')
    expect(itemReference).toMatch(/item-reference-details[\s\S]*item-reference-cost[\s\S]*item-reference-weight/)
    expect(itemReference).toContain('min-height: 78px')
    expect(itemReference).toContain('padding: 6px 0 6px 8px')
    expect(itemReference).toContain('white-space: normal')
    expect(itemReference).toContain('overflow-wrap: anywhere')
  })

  it('shows a selected background choice once and identifies its effects', () => {
    expect(source).toContain('{{ choiceEffectLabel(choice) }}')
    expect(source).toContain("selectedChoiceIds('grants_tool_item')")
    expect(source).toContain("selectedChoiceIds('grants_equipment_item')")
    expect(source).toContain("return 'Владение + предмет'")
    expect(source).toContain("return 'Владение'")
  })

  it('renders required item choices from background data with the shared equipment picker', () => {
    expect(source).toContain('<EquipmentItemSelect')
    expect(source).toContain('v-for="choice in activeBackgroundItemChoices"')
    expect(source).toContain('state.backgroundItemChoices?.[choice.key]')
    expect(source).toContain('setBackgroundItemChoice(choice.key, $event)')
    expect(source).toContain('backgroundItemChoicesComplete')
  })

  it('renders starting money as a prominent wallet using currency suggest icons', () => {
    expect(source).toContain('<BaseTile')
    expect(source).toContain('<BlockMoneyView')
    expect(source).toContain('suggestStore.ensure(17)')
    expect(source).toContain('currency?.svg')
    expect(source).toContain('class="background-wallet"')
    expect(source).toContain('.background-wallet :deep(.ma-img) { width: 24px; height: 24px;')
    expect(source).not.toContain('<span class="fk">Кошелёк</span>{{ moneyLabel }}')
  })
})
