import { createApp, h, reactive, computed } from 'vue'
import { createPinia } from 'pinia'
import { RowActionMenu } from '@sylvieshare/share-ui'
import DamageRollOptions from '../../src/features/character-editor/blocks/dnd/components/DamageRollOptions.vue'
import { useWeaponDamageRolls } from '../../src/features/character-editor/blocks/dnd/composables/useWeaponDamageRolls'
import { weaponUseDamageActions } from '../../src/features/character-editor/lib/weaponUseDamage'
import WeaponUsePanel from '../../src/features/character-editor/blocks/dnd/components/WeaponUsePanel.vue'
import WeaponUseEditor from '../../src/features/items/editor/WeaponUseEditor.vue'
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
dice.roll = (title, expression) => { window.damageRolls.push(expression); return { total: window.damage, parts: [{ kind: 'dice', sides: 6, sign: '+', rolls: [2, 3, 4, 6], color: '#ff0' }] } }
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
 const entry = computed(() => ctx.values.weapon[0])
 const damage = useWeaponDamageRolls(ctx, { item: () => item, itemTitle: () => item.name, propertyItems: () => [],
   weaponDamageActions: row => weaponUseDamageActions(ctx.values, row.uid), damagePartsRaw: () => [],
   damageExpression: () => '1d6{Колющий}+3{Колющий}', criticalDamageExpression: () => '2d6{Колющий}+3{Колющий}',
   extraCriticalDice: () => 0, spend: () => true,
 })
 const editorMode = new URLSearchParams(location.search).has('editor')
 return () => h('main', { style: 'max-width:600px;margin:8px' }, editorMode
  ? [h(WeaponUseEditor, { data: editorData.weapon_uses[0], fields: field.fields })]
  : [entry.value && ctx.ownerMode && h(RowActionMenu, { title: item.name }, {
      trigger: () => h('button', 'Оружие'),
      default: ({ close }) => h(DamageRollOptions, { canAttack: true, uses: use.choices(entry.value), actions: weaponUseDamageActions(ctx.values, entry.value.uid),
        preview: options => damage.damagePreview(entry.value, options),
        onAttack: options => { close(); options.weaponUseKey ? use.start(entry.value, options.weaponUseKey) : window.attacks++ },
        onRoll: options => { close(); damage.rollDamage(entry.value, options) },
      }),
    }), h(WeaponUsePanel, { uid: 'javelin' })])
} })
app.use(pinia); app.provide('charCtx', ctx)
app.provide(itemFieldEditorKey, { itemData: editorData, getSuggestId: field => field.suggest_id, getSuggests: id => suggest.items(id), setValidationError(key, value) { window.editorError = value } })
app.mount('#app')
