import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import ItemLastChargeEditor from '../../src/features/items/editor/ItemLastChargeEditor.vue'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
import ItemLastChargeCheck from '../../src/features/character-editor/blocks/dnd/components/ItemLastChargeCheck.vue'
import { useDiceStore } from '../../src/stores/dice'
import { createAbilityResourceSource, setCharacterResourceAvailable } from '../../src/features/character-editor/lib/characterResources'
const item = { id: 189, name: 'Посох ударов', typeId: 19, data: { max_use: 10, attunement: 'required', last_charge: { dice: 'd20', failure_max: 1, consequence: 'lose_magic' } } }
const items = new Map([['189', item]])
const initial = JSON.parse(sessionStorage.getItem('charge-state') || 'null') || { lvl: { level: 5 }, weapon: [{ uid: 'staff', item_id: 37, magic_item_id: 189, params: { magic: { attuned: true, remaining: 1 } } }] }
const ctx = reactive({ ownerMode: true, values: initial,
 updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('charge-state', JSON.stringify(this.values)) },
 logSessionEvent(event) { window.logged.push(event) },
})
window.logged = []; window.rolls = 0; window.result = 1; window.ctx = ctx
const pinia = createPinia(), dice = useDiceStore(pinia)
dice.roll = () => { window.rolls++; return { total: window.result, parts: [] } }
const editorData = reactive({ max_use: 10, last_charge: { ...item.data.last_charge } })
window.editorData = editorData; window.editorError = ''
const editorMode = new URLSearchParams(location.search).has('editor')
const app = createApp({ render: () => editorMode ? h(ItemLastChargeEditor, { data: editorData.last_charge }) : h('main', { style: 'max-width:440px;margin:16px' }, [
 h('button', { onClick: () => {
   const resource = createAbilityResourceSource('magic_items').collect(ctx.values, items)[0]
   if (resource) ctx.updateValues(setCharacterResourceAvailable(ctx.values, items, resource.key, 0, undefined, true))
 } }, 'Израсходовать последний заряд'),
 h(ItemLastChargeCheck, { uid: 'staff' }),
]) })
app.use(pinia); app.provide(itemFieldEditorKey, { itemData: editorData, setValidationError(key, value) { window.editorError = value } }); app.provide('charCtx', ctx); app.mount('#app')
