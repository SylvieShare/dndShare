import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, computed, ref } from 'vue'
import { createPinia } from 'pinia'
import { AppModalFrame, RowActionMenu } from '@sylvieshare/share-ui'
import DamageRollOptions from '../../src/features/character-editor/blocks/dnd/components/DamageRollOptions.vue'
import SelectedTargetPanel from '../../src/features/character-editor/blocks/dnd/components/SelectedTargetPanel.vue'
import DndDawnEditor from '../../src/features/character-editor/blocks/dnd/components/DndDawnEditor.vue'
import SelectedTargetEditor from '../../src/features/items/editor/SelectedTargetEditor.vue'
import { collectCharacterDerivedEffects, derivedRollEffects } from '../../src/features/character-editor/lib/characterDerivedEffects'
import { collectCharacterCombatEffects, matchingWeaponDamageActions } from '../../src/features/character-editor/lib/characterCombatEffects'
import { withWeaponThrowAction } from '../../src/features/character-editor/blocks/dnd/lib/weaponThrow'
import { useWeaponDamageRolls } from '../../src/features/character-editor/blocks/dnd/composables/useWeaponDamageRolls'
import { resolveRollMode } from '../../src/features/character-editor/blocks/dnd/lib/rollMode'
import { itemFieldEditorKey } from '../../src/features/character-editor/components/useItemFieldEditor'
import { useDiceStore } from '../../src/stores/dice'
import { useSuggestStore } from '../../src/stores/suggest'
import sql from '../../../internal/store/schema/105_selected_target.sql?raw'
const rule = JSON.parse(sql.split('$oath_target$')[1]), field = JSON.parse(sql.split('$target_field$')[1])
const item = { id: 202, typeId: 19, name: 'Лук клятвы', data: { weapon: { base_item_id: 61 }, is_long_range: true, selected_target: rule, attunement: 'required' } }
const ctx = reactive({ ownerMode: true,
 values: JSON.parse(sessionStorage.getItem('selected-target') || 'null') || { lvl: { level: 5 }, weapon: [{ uid: 'bow', item_id: 61, magic_item_id: 202, params: { magic: { attuned: true } } }] },
 characterResources: { itemsById: new Map([['202', item], ['61', { id: 61, typeId: 1 }]]), ensureItems: async () => {} },
 updateValues(patch) { this.values = { ...this.values, ...patch }; sessionStorage.setItem('selected-target', JSON.stringify(this.values)) }, logSessionEvent() {},
})
window.ctx = ctx; window.rolls = []; window.otherEffects = []
const pinia = createPinia(), dice = useDiceStore(pinia), suggest = useSuggestStore(pinia)
suggest.set(12, [{ id: 1, value: 'Колющий' }])
const editorData = reactive(structuredClone(item.data)); window.editorData = editorData; window.editorError = ''
dice.roll = (title, expression) => { window.rolls.push({ expression }); return { total: 12, parts: [] } }
const attack = (uid, mode = 'auto', weaponAttack = true) => {
 const effects = derivedRollEffects(collectCharacterDerivedEffects(ctx.values, ctx.characterResources.itemsById), { kind: 'attack', weaponKind: 'ranged', weaponAttack, targetId: uid })
 window.rolls.push({ mode: resolveRollMode(mode, [...effects, ...window.otherEffects]).mode })
}
const app = createApp({ setup() {
 const dawn = ref(false), entry = computed(() => ctx.values.weapon[0])
 const actions = row => withWeaponThrowAction(matchingWeaponDamageActions(collectCharacterCombatEffects(ctx.values, ctx.characterResources.itemsById), { weaponUid: row.uid, ranged: !row._improvisedThrow }).map(action => ({ ...action, damage_type_label: 'Колющий' })), item)
 const damage = useWeaponDamageRolls(ctx, { item: () => item, itemTitle: () => item.name, propertyItems: () => [], weaponDamageActions: actions, damagePartsRaw: () => [],
  damageExpression: () => '1d8{Колющий}+3{Колющий}', criticalDamageExpression: () => '2d8{Колющий}+3{Колющий}', extraCriticalDice: () => 0, spend: () => true })
 const editorMode = new URLSearchParams(location.search).has('editor')
 return () => h('main', { style: 'max-width:600px;margin:8px' }, editorMode ? [h(SelectedTargetEditor, { data: editorData.selected_target, fields: field.fields })] : [
  h(SelectedTargetPanel, { uid: 'bow' }),
  ctx.ownerMode && h(RowActionMenu, { title: item.name }, {
   trigger: () => h('button', 'Оружие'),
   default: ({ close }) => h(DamageRollOptions, { weaponUid: 'bow', canAttack: true, actions: actions(entry.value), preview: options => damage.damagePreview(entry.value, options),
    onAttack: options => { attack('bow', options.attackRollMode); close() }, onRoll: options => { damage.rollDamage(entry.value, options); close() },
   }),
  }), ctx.ownerMode && h('button', { onClick: () => attack('sword') }, 'Атака другим оружием'),
  ctx.ownerMode && h('button', { onClick: () => dawn.value = true }, 'Рассвет'),
  dawn.value && h(AppModalFrame, { title: 'Рассвет', onClose: () => dawn.value = false }, () => h(DndDawnEditor, { values: ctx.values, onApply: result => ctx.updateValues(result.patch), onClose: () => dawn.value = false })),
 ])
} })
app.use(pinia); app.provide('charCtx', ctx)
app.provide(itemFieldEditorKey, { itemData: editorData, getSuggestId: f => f.suggest_id, getSuggests: id => suggest.items(id), setValidationError(key, value) { window.editorError = value } })
app.mount('#app')
