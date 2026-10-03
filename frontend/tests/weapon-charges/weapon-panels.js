import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import WeaponItemMechanics from '../../src/features/character-editor/blocks/dnd/components/WeaponItemMechanics.vue'
import { collectCharacterResources, setCharacterResourceAvailable } from '../../src/features/character-editor/lib/characterResources'
const base = { id: 1448, name: 'Метательное копьё', typeId: 1, data: { notes: '<p>Копьё приспособлено для метания.</p>', range_min: 30, range_max: 120 } }
const magic = { id: 284, name: 'Метательное копьё молнии', typeId: 19, data: {
  weapon: { base_item_id: 1448 }, attunement: 'none', max_use: 1, dawn_recovery: { mode: 'full' },
  desc: '<p>Молния образует линию до цели в пределах 120 футов. Спасбросок Ловкости Сл 13.</p>',
  weapon_uses: [{ key: 'lightning', title: 'Метнуть молнией' }],
} }
const items = new Map([['1448', base], ['284', magic]])
const ctx = reactive({ ownerMode: true, values: { lvl: { level: 5 }, weapon: [
  { uid: 'magic', item_id: 1448, magic_item_id: 284, params: { magic: { remaining: 1 } } },
  { uid: 'plain', item_id: 1448 },
] }, characterResources: { itemsById: items }, updateValues(patch) { this.values = { ...this.values, ...patch } } })
window.ctx = ctx
const app = createApp({ render: () => h('main', { style: 'max-width:640px;margin:16px' }, ctx.values.weapon.map(entry =>
  h('section', { 'data-testid': entry.uid }, [h('h2', entry.uid === 'magic' ? magic.name : base.name), h(WeaponItemMechanics, { entry })]))) })
app.use(createPinia()); app.provide('charCtx', ctx)
app.provide('weaponsBlockCtx', { charCtx: ctx, itemMap: { 1448: base, 284: magic }, item: entry => items.get(String(entry.magic_item_id ?? entry.item_id)),
  weaponResources: entry => collectCharacterResources(ctx.values, items).filter(resource => resource.source.entryKey === entry.uid),
  toggleWeaponResource(resource, pip) { ctx.updateValues(setCharacterResourceAvailable(ctx.values, items, resource.key, pip <= resource.value ? pip - 1 : pip)) },
})
app.mount('#app')
