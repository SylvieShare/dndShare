import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import DndSpells from '../../../src/features/character-editor/blocks/dnd/DndSpells.vue'
import { useDiceStore } from '../../../src/stores/dice'
import { useSuggestStore } from '../../../src/stores/suggest'
import { itemsApi } from '../../../src/shared/api/itemsApi'
import { resolveRollMode } from '../../../src/features/character-editor/blocks/dnd/lib/rollMode'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
useSuggestStore(pinia).set(16, [{ id: 4, value: 'Интеллект' }])
useSuggestStore(pinia).set(12, [{ id: 10, value: 'Некротический' }])
useSuggestStore(pinia).set(7, [])
const items = [
  { id: 495, name: 'Леденящее прикосновение', data: { lvl: 0, damage: { range_attack: true, scaling: 'cantrip',
    dices: [{ count: 1, dice_id: 'd8', type: 10, bonus: 3 }], addon: [{ count: 1, dice_id: 'd8', type: 10 }] } } },
  { id: 2, name: 'Урон со спасброском', data: { lvl: 1, damage: { save_ability: 'dex', dices: [{ count: 2, dice_id: 'd6' }] } } },
  { id: 3, name: 'Лечение', data: { lvl: 1, heal: { add_mod: true, scaling: 'slot', dices: [{ count: 1, dice_id: 'd4' }], addon: [{ count: 1, dice_id: 'd4' }] } } },
  { id: 5, name: 'Луч атаки', data: { lvl: 1, damage: { range_attack: true, scaling: 'slot', dices: [{ count: 2, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] } } },
  { id: 4, name: 'Свет', data: { lvl: 0 } },
  { id: 6, name: 'Ледяной кинжал', data: { lvl: 1, damage: { range_attack: true }, rolls: [
    { kind: 'damage', label: 'Попадание кинжалом', range_attack: true, dices: [{ count: 1, dice_id: 'd10' }] },
    { kind: 'damage', label: 'Взрыв', scaling: 'slot', dices: [{ count: 2, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] },
  ] } },
  { id: 7, name: 'Расовое возмездие', data: { lvl: 1, damage: { scaling: 'slot', dices: [{ count: 2, dice_id: 'd10' }], addon: [{ count: 1, dice_id: 'd10' }] } } },
]
itemsApi.byIds = async ids => ({ items: items.filter(item => ids.map(Number).includes(item.id)) })
window.rolls = []; window.writes = []; window.events = []
const dice = useDiceStore(pinia)
dice.rollD20 = (title, bonus, mode) => window.rolls.push({ title, bonus, mode })
dice.roll = (title, expression) => window.rolls.push({ title, expression })
const ctx = reactive({ ownerMode: true, var: { stats: { 4: 3 } },
  characterArmor: { state: { castingBlocked: false } },
  characterRolls: { resolve: (mode, context) => {
    window.attackContext = context
    return resolveRollMode(mode, [{ mode: 'disadvantage', source: 'Состояние' }])
  } },
  logSessionEvent: event => window.events.push(event),
})
window.spellCtx = ctx
const value = { schema_version: 2, slots_auto: false,
  slot_pools: { long_rest: [{ level: 1, total: 2, used: 0 }, { level: 3, total: 1, used: 0 }], short_rest: [{ level: 3, total: 1, used: 0 }] },
  tabs: [{ key: 'wizard', name: 'Волшебник', casting_ability: 4, mode: 'prepared', attack_bonus: 1,
    spells: items.filter(item => item.id !== 7).map(item => ({ key: String(item.id), id: item.id, prepared: item.data.lvl > 0 })) }], grants: [{ key: 'innate:7', id: 7, slotless: true, cast_level: 2, source: { label: 'Дьявольское наследие' } }],
}
createApp({ render: () => h('main', { style: 'max-width:900px;margin:16px' }, [h(DndSpells, {
  block: { id: 'spells', content: { stat_suggest_type_id: 16, prof_bonus_path: 'prof_bonus.v', school_suggest_id: 7 } },
  value, values: { prof_bonus: { v: 3 }, lvl: { level: 5 } },
  'onUpdate:value': (_, next) => window.writes.push(next),
})]) }).use(pinia).provide('charCtx', ctx).mount('#app')
