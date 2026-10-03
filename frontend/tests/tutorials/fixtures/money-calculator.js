import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import BlockMoney from '../../../src/features/character-editor/blocks/generic/BlockMoney.vue'
import CalcPad from '../../../src/features/character-editor/components/CalcPad.vue'
import { useSuggestStore } from '../../../src/stores/suggest'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="13" fill="currentColor"/><circle cx="16" cy="16" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
useSuggestStore(pinia).set(17, [
  { id: 1, value: 'мм', svg, color: 'var(--warning)' },
  { id: 2, value: 'см', svg, color: 'var(--text-muted)' },
  { id: 3, value: 'зм', svg, color: 'var(--warning)' },
])
const ownerMode = !new URLSearchParams(location.search).has('readonly')
const state = reactive({ money: { order: [1, 2, 3], amounts: { 1: 10, 2: 0, 3: 1234567 } }, expression: '' })
window.moneyState = state
window.writes = []
createApp({ render: () => h('main', { style: 'max-width:320px;margin:24px' }, [
  h(BlockMoney, { block: { id: 'money', props: { title: 'Деньги' }, content: { suggest_type_id: 17 } }, value: state.money,
    'onUpdate:value': (id, value) => { window.writes.push({ id, value }); state.money = value },
  }),
  h('section', { 'data-testid': 'plain-calculator', style: 'margin-top:32px' }, [h(CalcPad, { modelValue: state.expression, 'onUpdate:modelValue': value => { state.expression = value } })]),
]) }).use(pinia).provide('charCtx', { ownerMode }).mount('#app')
