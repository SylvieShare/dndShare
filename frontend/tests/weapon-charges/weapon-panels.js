import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { SectionList } from '@sylvieshare/share-ui'
import WeaponCard from '../../src/features/character-editor/blocks/dnd/components/WeaponCard.vue'
import { collectCharacterResources, setCharacterResourceAvailable } from '../../src/features/character-editor/lib/characterResources'
import { availableWeaponUses, startWeaponUse } from '../../src/features/character-editor/lib/weaponUses'
import { itemsApi } from '../../src/shared/api/itemsApi'
import { useItemTypesStore } from '../../src/stores/itemTypes'
import { useSuggestStore } from '../../src/stores/suggest'
import sql from '../../../internal/store/schema/102_weapon_uses.sql?raw'
const rule = JSON.parse(sql.split('$lightning_throw$')[1])
const base = { id: 1448, name: 'Метательное копьё', typeId: 1, data: { notes: '<p>Просто описание копья.</p>', range_min: 30, range_max: 120 } }
const javelin = { id: 284, name: 'Метательное копьё молнии', typeId: 19, data: { weapon: { base_item_id: 1448 }, attunement: 'none', max_use: 1, desc: '<p>Общее описание магического оружия.</p>', weapon_uses: [rule] } }
const mace = { id: 273, name: 'Булава ужаса', typeId: 19, data: { weapon: { base_item_id: 1448 }, attunement: 'required', max_use: 3,
 status_effects: [{ key: 'terror', effect: { id: 4615 }, target: 'other', condition: 'Волна ужаса за 1 заряд.' }], feature_actions: [{ key: 'terror', uses_resource: true, resource_cost: 1 }] } }
const effect = { id: 4615, name: 'Ужас', typeId: 15, data: { desc: '<p>Цель испугана.</p>' } }
const items = new Map([['1448', base], ['284', javelin], ['273', mace], ['4615', effect]])
itemsApi.byIds = async ids => ({ items: ids.map(id => items.get(String(id))).filter(Boolean) })
const pinia = createPinia(); useItemTypesStore(pinia).types = [1,19,15].map(id => ({ id, fields: [] }))
const suggest = useSuggestStore(pinia); for (const id of [12,14,16,17]) suggest.set(id, [])
const ctx = reactive({ ownerMode: true, values: { lvl: { level: 5 }, weapon: [
 { uid: 'javelin', _key: 'javelin', item_id: 1448, magic_item_id: 284, params: { magic: { remaining: 1 } } },
 { uid: 'mace', _key: 'mace', item_id: 1448, magic_item_id: 273, params: { magic: { attuned: true, remaining: 3 } } },
 { uid: 'plain', _key: 'plain', item_id: 1448 },
] }, characterResources: { itemsById: items }, updateValues(patch) { this.values = { ...this.values, ...patch } } })
window.ctx = ctx
const weapons = reactive({ charCtx: ctx, itemMap: Object.fromEntries(items), sortable: { dragging: false, isSource: () => false },
 item: entry => items.get(String(entry.magic_item_id ?? entry.item_id)), itemTitle: entry => weapons.item(entry).name,
 itemSubtitle: () => '', magicBonus: () => 0, rangeLabel: () => '30/120 футов', propertyItems: () => [], isWeaponProficient: () => false,
 formatBonus: value => '+' + value, attackBonus: () => 5, damageBonus: () => 3, damagePartsRaw: () => [], twoHandedParts: () => [],
 hasWeaponDamage: () => true, weaponDamageActions: () => [], damagePreview: () => '', canMoveWeaponToItems: () => false,
 weaponUses: entry => availableWeaponUses(ctx.values, items, entry.uid, ctx.ownerMode),
 weaponResources: entry => collectCharacterResources(ctx.values, items).filter(resource => resource.source.entryKey === entry.uid),
 toggleWeaponResource(resource, pip) { ctx.updateValues(setCharacterResourceAvailable(ctx.values, items, resource.key, pip <= resource.value ? pip - 1 : pip)) },
 rollAttack(entry, options) { const result = startWeaponUse(ctx.values, items, entry.uid, options.weaponUseKey, { expression: '1d6+3', critical_expression: '2d6+3' }); if (result.error) throw Error(result.error); ctx.updateValues(result.patch) },
 onDragStart() {}, showPropertyTooltip() {}, hidePropertyTooltip() {}, openItemModal() {}, openMagicInstance() {},
})
const app = createApp({ render: () => h('main', { style: 'max-width:900px;margin:16px' }, [h(SectionList, { title: 'Оружие' }, () => ctx.values.weapon.map((entry,index) => h(WeaponCard, { entry, index, 'data-testid': entry.uid })))]) })
app.use(pinia); app.provide('charCtx', ctx); app.provide('weaponsBlockCtx', weapons); app.mount('#app')
