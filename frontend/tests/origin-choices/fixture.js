import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAccountStore } from '../../src/stores/account'
import { clickOutside } from '../../src/shared/lib/clickOutside'
import OriginChoices from '../../src/features/character-list/components/wizard/steps/OriginChoices.vue'
import AbilityBonusPicker from '../../src/shared/ui/AbilityBonusPicker.vue'
import { useDndOrigin } from '../../src/features/character-list/composables/useDndOrigin'

const params = new URLSearchParams(location.search)
const feat = { id: 7107, typeId: 7, name: 'Дикий атакующий', data: { category: 'origin', description: '<p>Перебросьте кости урона оружия и выберите результат.</p>' } }
const state = reactive({ version: '2024', background: { id: 7190, data: { ability_options: [1, 2, 3], origin_feat_id: feat.id } },
  backgroundAsi: params.has('restore') ? { STR: 1, DEX: 1, CON: 1 } : {}, originFeatChoices: {}, featIds: [], asiChoice: [] })
const origin = useDndOrigin(state, ref([feat]))
window.state = state
const app = createApp({ setup() { return () => h('main', { style: 'max-width:760px;margin:16px' }, [
  params.has('level') ? h(AbilityBonusPicker, { patterns: [[2], [1, 1]], scores: { STR: 19, DEX: 18, CON: 20, INT: 12, WIS: 12, CHA: 12 },
    modelValue: state.backgroundAsi, 'onUpdate:modelValue': value => { state.backgroundAsi = value },
  }) : params.has('race') ? h(AbilityBonusPicker, { title: 'Характеристики расы', patterns: [[1, 1]],
    modelValue: Object.fromEntries(state.asiChoice.map(stat => [stat, 1])),
    'onUpdate:modelValue': value => { state.asiChoice = Object.keys(value) },
  }) : h(OriginChoices),
  h('button', { onClick: () => { state.background = { id: 7183, data: { ability_options: [3, 4, 5], origin_feat_id: feat.id } }; state.backgroundAsi = {} } }, 'Сменить предысторию'),
  h('output', { 'data-testid': 'complete' }, String(origin.originComplete.value)),
]) } })
const pinia = createPinia()
const account = useAccountStore(pinia)
account.status = 'success'; account.user = { id: 1, roles: [] }
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
app.use(pinia).use(router).provide('createWizard', { state, ...origin }).directive('click-outside', clickOutside).mount('#app')
