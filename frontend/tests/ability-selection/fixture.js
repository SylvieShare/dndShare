import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useAccountStore } from '../../src/stores/account'
import { clickOutside } from '../../src/shared/lib/clickOutside'
import DndLevelUpModal from '../../src/features/character-editor/blocks/dnd/components/DndLevelUpModal.vue'
import DndAbilities from '../../src/features/character-editor/blocks/dnd/DndAbilities.vue'
import { items } from './data'
const params = new URLSearchParams(location.search)
const level = Number(params.get('level') || 1)
const initial = { lvl: { level }, classes: [{ id: 4018, name: 'Колдун', level }], hp: { current: 10, max: 10 }, CON: { value: 12 },
  abilities_class: level > 1 ? [{ id: 4069 }, ...(params.has('empty') ? [] : [{ id: 9000, uid: 'old1' }, { id: 9001, uid: 'old2' }])] : [],
}
const ctx = reactive({ ownerMode: !params.has('reader'), values: JSON.parse(sessionStorage.getItem('invocations') || 'null') || initial,
  characterResources: { itemsById: new Map(items.map(item => [String(item.id), item])), resources: [], rememberItems() {} },
  updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('invocations', JSON.stringify(this.values)) },
})
window.ctx = ctx
const opened = ref(false)
const app = createApp({ setup() { return () => h('main', { style: 'max-width:750px;margin:16px' }, [
  h('button', { onClick: () => { opened.value = true } }, 'Повысить уровень'),
  h(DndAbilities, { block: { id: 'abilities_class', title: 'Классовые способности', content: { item_id: 4, expanded: true } },
    values: ctx.values, value: ctx.values.abilities_class, 'onUpdate:value': (key, value) => ctx.updateValues({ [key]: value }) }),
  opened.value && h(DndLevelUpModal, { values: ctx.values, onClose: () => { opened.value = false }, onApply: patch => { ctx.updateValues(patch); opened.value = false } }),
]) } })
const pinia = createPinia()
const account = useAccountStore(pinia)
account.status = 'success'; account.user = { id: 1, roles: [] }
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
app.use(pinia).use(router).provide('charCtx', ctx).directive('click-outside', clickOutside).mount('#app')
