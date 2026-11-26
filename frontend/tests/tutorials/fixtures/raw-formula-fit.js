import { createApp, h, reactive } from 'vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/fonts.css'
import '../../../src/app/theme.css'
import CharacterCombatMetric from '../../../src/features/character-editor/blocks/dnd/components/CharacterCombatMetric.vue'
import WeaponDamageBreakdown from '../../../src/features/character-editor/blocks/dnd/components/WeaponDamageBreakdown.vue'
import DamageDice from '../../../src/features/character-editor/blocks/dnd/components/DamageDice.vue'
import DamageFormulaPreview from '../../../src/features/character-editor/blocks/dnd/components/DamageFormulaPreview.vue'
import SaveFormulaPreview from '../../../src/features/sessions/components/SaveFormulaPreview.vue'
const state = reactive({ width: 160, count: 10 })
window.formulaState = state
const parts = () => Array.from({ length: state.count }, (_, i) => ({ count: 2, diceSides: 4 + (i % 5) * 2, diceLabel: `d${4 + (i % 5) * 2}` }))
const expression = () => parts().map(part => `${part.count}${part.diceLabel}`).join('+')
const row = component => h(component, { rows: [{ source: 'Формула', expression: expression() }] })
createApp({ render: () => h('main', { style: `width:${state.width}px;max-width:100%;padding:12px` }, [
  ['metric', () => h(CharacterCombatMetric, { kind: 'damage', label: 'Урон' }, { default: () => row(WeaponDamageBreakdown) })],
  ['weapon', () => row(WeaponDamageBreakdown)],
  ['dice', () => h(DamageDice, { parts: parts(), modifier: 3 })],
  ['preview', () => h(DamageFormulaPreview, { expression: expression(), label: 'Формула' })],
  ['attack', () => h(CharacterCombatMetric, { kind: 'attack', label: 'Атака' }, { default: () => row(WeaponDamageBreakdown) })],
  ['save', () => h(SaveFormulaPreview, { profile: { mode: 'advantage', bonus: 7, formula: expression() } })],
].map(([name, render]) => h('section', { 'data-formula-case': name, style: 'width:100%;min-width:0;margin-bottom:16px' }, render()))) }).mount('#app')
