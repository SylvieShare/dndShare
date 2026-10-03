import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import DndItems from '../../../src/features/character-editor/blocks/dnd/DndItems.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import { inventoryCatalogue } from './inventoryData.js'
import { deriveEquippedArmor } from '../../../src/features/character-editor/blocks/dnd/lib/equippedArmor'
import { useSuggestStore } from '../../../src/stores/suggest'
const item = (uid, name) => ({ uid, count: 2, override: { name, desc: `Описание: ${name}` }, params: {} })
const initial = { equipped: [{ ...item('worn', 'Плащ'), count: 1, item_id: 122 }], sections: [
  { id: 'bag', name: 'Рюкзак', items: [item('a', 'Верёвка'), item('b', 'Факел')] },
  { id: 'chest', name: 'Сундук', items: [item('c', 'Камень'), { ...item('armor', 'Кожаный доспех'), count: 1, item_id: 121 }] },
] }
const model = ref(JSON.parse(localStorage.getItem('test-inventory') || JSON.stringify(initial)))
const viewer = new URLSearchParams(location.search).has('viewer')
const catalogue = Object.fromEntries(inventoryCatalogue.map(item => [item.id, item]))
const money = ref({ order: [1, 2, 3], amounts: { 1: 10, 3: 42 } })
const pinia = createPinia()
useSuggestStore(pinia).set(17, [{ id: 1, value: 'мм' }, { id: 2, value: 'см' }, { id: 3, value: 'зм' }])
window.walletWrites = []
const ctx = reactive({ ownerMode: !viewer, get values() { return { items: model.value, money: money.value } },
  updateValues(patch) { if (!viewer && patch.money) { money.value = patch.money; window.walletWrites.push(patch) } },
  get characterArmor() { return { state: deriveEquippedArmor({ items: model.value }, catalogue) } } })
window.readWallet = () => JSON.parse(JSON.stringify(money.value))
window.readInventory = () => structuredClone(JSON.parse(JSON.stringify(model.value)))
createApp({
  setup() {
    return () => h(DndItems, { block: { id: 'items', title: 'Предметы', content: { wallet: { value_id: 'money', suggest_type_id: 17 } } }, value: model.value,
      'onUpdate:value': (_, next) => { model.value = next; localStorage.setItem('test-inventory', JSON.stringify(next)) } })
  },
}).provide('charCtx', ctx).use(pinia).mount('#app')
const style = document.createElement('style')
style.textContent = 'body { margin: 0; padding: 16px; background: var(--bg); font-family: var(--font-ui); } #app { max-width: 700px; margin: auto; }'
document.head.appendChild(style)
