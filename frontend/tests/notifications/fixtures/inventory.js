import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import DndItems from '../../../src/features/character-editor/blocks/dnd/DndItems.vue'
import '@sylvieshare/share-ui/styles.css'
const item = (uid, name) => ({ uid, count: 2, override: { name, desc: `Описание: ${name}` }, params: {} })
const initial = { equipped: [item('worn', 'Плащ')], sections: [
  { id: 'bag', name: 'Рюкзак', items: [item('a', 'Верёвка'), item('b', 'Факел')] },
  { id: 'chest', name: 'Сундук', items: [item('c', 'Камень')] },
] }
const model = ref(JSON.parse(localStorage.getItem('test-inventory') || JSON.stringify(initial)))
const viewer = new URLSearchParams(location.search).has('viewer')
const ctx = reactive({ ownerMode: !viewer, get values() { return { items: model.value } } })
window.readInventory = () => structuredClone(JSON.parse(JSON.stringify(model.value)))
createApp({
  setup() {
    return () => h(DndItems, { block: { id: 'items', title: 'Предметы', content: {} }, value: model.value,
      'onUpdate:value': (_, next) => { model.value = next; localStorage.setItem('test-inventory', JSON.stringify(next)) } })
  },
}).provide('charCtx', ctx).use(createPinia()).mount('#app')
const style = document.createElement('style')
style.textContent = 'body { margin: 0; padding: 16px; background: var(--bg); font-family: var(--font-ui); } #app { max-width: 700px; margin: auto; }'
document.head.appendChild(style)
