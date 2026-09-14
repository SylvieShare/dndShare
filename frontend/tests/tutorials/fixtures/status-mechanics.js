import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { RowActionMenu } from '@sylvieshare/share-ui'
import StatusMechanicsMenu from '../../../src/features/character-editor/blocks/dnd/components/StatusMechanicsMenu.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const poison = { id: 1, name: 'Яд из зелья', data: { ongoing_damage: { dice_count: 3, dice: 'd6', save_ability: 3, save_dc: 13, decrease_on_save: 1, damage_type: 4 } } }
const oil = { id: 2, name: 'Масло остроты', data: { weapon_target: { damage_types: [1, 2] } } }
const ctx = reactive({ ownerMode: true, values: { hp: { current: 50, temp: 0 }, CON: { value: 10 }, states: [{ uid: 'poison', effect_id: 1, params: {} }, { uid: 'oil', effect_id: 2, params: {} }], weapon: [{ uid: 'sword', item_id: 3 }] }, characterResources: { itemsById: new Map([['3', { id: 3, name: 'Меч', data: { attacks: [{ type: 2 }] } }]]) }, updateValues(patch) { Object.assign(ctx.values, patch) } })
window.statusCtx = ctx
createApp({ render: () => h('main', { style: 'padding:24px;display:flex;gap:16px' }, [poison, oil].map(effect => h(RowActionMenu, { title: effect.name }, { trigger: () => h('button', effect.name), default: () => h(StatusMechanicsMenu, { uid: effect === poison ? 'poison' : 'oil', effect }) }))) }).use(createPinia()).provide('charCtx', ctx).mount('#app')
