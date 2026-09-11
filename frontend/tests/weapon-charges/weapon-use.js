import { createApp, h, reactive, computed } from 'vue'
import { createPinia } from 'pinia'
import WeaponRollControls from '../../src/features/character-editor/blocks/dnd/components/WeaponRollControls.vue'
import WeaponUsePanel from '../../src/features/character-editor/blocks/dnd/components/WeaponUsePanel.vue'
import WeaponUseEditor from '../../src/features/items/editor/WeaponUseEditor.vue'
import WeaponUseSummary from '../../src/features/items/detail-components/WeaponUseSummary.vue'
import { useWeaponUses } from '../../src/features/character-editor/blocks/dnd/composables/useWeaponUses'
import { useDiceStore } from '../../src/stores/dice'
import { useSuggestStore } from '../../src/stores/suggest'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
import sql from '../../../internal/store/schema/102_weapon_uses.sql?raw'
const rule = JSON.parse(sql.split('$lightning_throw$')[1]), field = JSON.parse(sql.split('$weapon_use_field$')[1])
const pinia = createPinia(), dice = useDiceStore(pinia), suggest = useSuggestStore(pinia)
suggest.set(12, [{ id: 9, value: 'Молния', color: '#ff0' }]); suggest.set(16, [{ id: 2, value: 'Ловкость' }])
window.damageRolls = []; window.attacks = 0; window.natural = 10
window.damage = 15; window.logged = []
dice.roll = (title, expression) => { window.damageRolls.push(expression); return { total: window.damage, parts: [] } }
const item = { id: 284, typeId: 19, name: 'Метательное копьё молнии', data: { attunement: 'none', max_use: 1, weapon_uses: [rule] } }
const ctx = reactive({ ownerMode: true,
 values: JSON.parse(sessionStorage.getItem('weapon-use-state') || 'null') || { lvl: { level: 5 }, weapon: [{ uid: 'javelin', item_id: 1448, magic_item_id: 284, params: { magic: { remaining: 1 } } }] },
 characterResources: { itemsById: new Map([['284', item]]) },
 updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('weapon-use-state', JSON.stringify(this.values)) },
 logSessionEvent(event) { window.logged.push(event) },
})
window.ctx = ctx
const editorData = reactive(structuredClone(item.data)); window.editorData = editorData; window.editorError = ''
const app = createApp({ setup() {
 const use = useWeaponUses(ctx, { title: () => item.name,
  prepare: entry => ({ entry, expression: '1d6{Колющий}+3{Колющий}', critical_expression: '2d6{Колющий}+3{Колющий}', critical_threshold: 20 }),
  attack() { window.attacks++; return { total: window.natural + 5, parts: [{ kind: 'dice', sides: 20, rolls: [window.natural] }] } },
 })
 const state = reactive({ key: '' }), entry = computed(() => ctx.values.weapon[0])
 const editorMode = new URLSearchParams(location.search).has('editor')
 return () => h('main', { style: 'max-width:600px;margin:8px' }, editorMode
  ? [h(WeaponUseEditor, { data: editorData.weapon_uses[0], fields: field.fields })]
  : [entry.value && h(WeaponRollControls, { scope: 'attack', uses: use.choices(entry.value), useKey: state.key,
     'onUpdate:useKey': key => state.key = key, onRoll: () => state.key ? use.start(entry.value, state.key) : window.attacks++ }),
    h(WeaponUsePanel, { uid: 'javelin' }), h(WeaponUseSummary, { uses: item.data.weapon_uses, data: item.data })])
} })
app.use(pinia); app.provide('charCtx', ctx)
app.provide(itemFieldEditorKey, { itemData: editorData, getSuggestId: field => field.suggest_id, getSuggests: id => suggest.items(id), setValidationError(key, value) { window.editorError = value } })
app.mount('#app')
