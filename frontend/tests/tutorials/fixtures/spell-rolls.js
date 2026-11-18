import { blessingEffects } from './blessing'
import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import DndRest from '../../../src/features/character-editor/blocks/dnd/DndRest.vue'
import DndSpells from '../../../src/features/character-editor/blocks/dnd/DndSpells.vue'
import { useDiceStore } from '../../../src/stores/dice'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import { useSuggestStore } from '../../../src/stores/suggest'
import { useItemTypesStore } from '../../../src/stores/itemTypes'
import { itemsApi } from '../../../src/shared/api/itemsApi'
import { resolveRollMode } from '../../../src/features/character-editor/blocks/dnd/lib/rollMode'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import '../../../src/app/fonts.css'

document.body.style.cssText = 'margin:0;background:var(--bg);color:var(--text-1);font-family:var(--font-ui,system-ui,sans-serif)'

const pinia = createPinia()
if (new URLSearchParams(location.search).has('session')) useSessionEventsStore(pinia).sessionUuid = 'spell-roll-test-session'
useItemTypesStore(pinia).types = [{ id: 5, name: 'Заклинания', coverImageUrl: '/tests/tutorials/fixtures/spell-covers/default.webp' }]
useSuggestStore(pinia).set(16, [{ id: 4, value: 'Интеллект' }])
useSuggestStore(pinia).set(12, [{ id: 10, value: new URLSearchParams(location.search).has('long-type') ? 'Некротической энергией древнего проклятия' : 'Некротический' }])
if (new URLSearchParams(location.search).has('eldritch')) useSuggestStore(pinia).set(12, [{ id: 12, value: 'Силовое поле' }])
useSuggestStore(pinia).set(7, [])
const items = [
  { id: 495, name: 'Леденящее прикосновение', data: { lvl: 0, damage: { range_attack: true, scaling: 'cantrip',
    dices: [{ count: 1, dice_id: 'd8', type: 10, bonus: 3 }], addon: [{ count: 1, dice_id: 'd8', type: 10 }] } } },
  { id: 2, name: 'Урон со спасброском', data: { lvl: 1, damage: { save_ability: 'dex', dices: [{ count: 2, dice_id: 'd6' }] } } },
  { id: 3, name: 'Лечение', data: { lvl: 1, heal: { add_mod: true, scaling: 'slot', dices: [{ count: 1, dice_id: 'd4' }], addon: [{ count: 1, dice_id: 'd4' }] } } },
  { id: 5, name: 'Луч атаки', data: { lvl: 1, damage: { range_attack: true, scaling: 'slot', dices: [{ count: 2, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] } } },
  { id: 4, name: 'Свет', data: { lvl: 0, time: { kind: 'action' }, range: { kind: 'touch' }, duration: '1 час', components: { v: true, m: 'Светлячок' } } },
  { id: 6, name: 'Ледяной кинжал', data: { lvl: 1, damage: { range_attack: true }, rolls: [
    { kind: 'damage', label: 'Попадание кинжалом', range_attack: true, dices: [{ count: 1, dice_id: 'd10' }] },
    { kind: 'damage', label: 'Взрыв', scaling: 'slot', dices: [{ count: 2, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] },
  ] } },
  { id: 7, name: 'Расовое возмездие', data: { lvl: 1, damage: { scaling: 'slot', dices: [{ count: 2, dice_id: 'd10' }], addon: [{ count: 1, dice_id: 'd10' }] } } },
]
if (new URLSearchParams(location.search).has('eldritch')) items.push({ id: 500, name: 'Мистический заряд', data: {
  lvl: 0, time: { kind: 'action' }, range: { kind: 'ranged', distance: 120, unit: 'feet' },
  damage: { dices: [{ type: 12, count: 1, dice_id: 'd10' }], addon: [], scaling: 'cantrip',
    instances: 1, addon_instances: 1, range_attack: true, attack_chain: { unique: 'none', trigger: 'none' } },
} })
if (new URLSearchParams(location.search).has('presentation')) {
  Object.assign(items.find(item => item.id === 4).data, { concentration: true, ritual: true })
  items.push({ id: 8, name: 'Божественное оружие', nameEn: 'Spiritual Weapon with a deliberately long English title', data: { lvl: 2, time: { kind: 'bonus_action' }, range: { kind: 'ranged', distance: 60 }, duration: '1 минута', components: { v: true, s: true }, damage: { range_attack: true, add_mod: true, scaling: 'slot', scaling_step: 2, dices: [{ count: 1, dice_id: 'd8' }], addon: [{ count: 1, dice_id: 'd8' }] } } })
}
if (new URLSearchParams(location.search).has('long-name')) items.find(item => item.id === 8).name += ' — заклинание с очень длинным названием, которое должно полностью переноситься на следующие строки'
if (new URLSearchParams(location.search).has('covers')) {
  Object.assign(items.find(item => item.id === 8), { coverImageUrl: '/tests/tutorials/fixtures/spell-covers/custom.webp' })
  Object.assign(items.find(item => item.id === 8).data, { concentration: true, ritual: true, duration: 'Концентрация, вплоть до 1 минуты', components: { v: true, s: true, m: 'Крошечный серебряный молот' } })
  items.find(item => item.id === 3).coverImageUrl = '/missing-spell-cover.webp'
}
if (new URLSearchParams(location.search).has('materials')) {
  items.push({id:863,typeId:5,name:'Возрождение',data:{lvl:3,time:{kind:'action'},range:{kind:'touch'},duration:'Мгновенная',components:{v:true,s:true,m:'бриллианты, стоящие в сумме 300 зм, расходуемые заклинанием'}}})
}
if (new URLSearchParams(location.search).has('cards')) {
  const english = { 495: 'Chill Touch', 2: 'Damage with a Saving Throw', 3: 'Cure Wounds', 4: 'Light', 5: 'Attack Ray', 6: 'Ice Knife', 7: 'Innate Retribution' }
  items.forEach(item => {
    item.nameEn ||= english[item.id] || 'Spiritual Weapon'
    item.data.time ||= { kind: 'action' }
    item.data.range ||= { kind: 'ranged', distance: 60 }
    item.data.components ||= { v: true, s: true }
  })
  items.push({ id: 9, name: 'Ложная жизнь', nameEn: 'False Life', data: { lvl: 1, heal: { kind: 'temporary_hp', dices: [{ count: 1, dice_id: 'd4', bonus: 4 }] } } })
  items.push({ id: 10, name: 'Усыпление', nameEn: 'Sleep', data: { lvl: 1, rolls: [{ kind: 'effect', label: 'Запас хитов', dices: [{ count: 5, dice_id: 'd8' }] }] } })
}
if (new URLSearchParams(location.search).has('fitting')) {
  items.push({ id: 41, name: 'Снаряд хаоса', nameEn: 'Chaos Bolt', data: { lvl: 1,
    damage: { range_attack: true, scaling: 'slot', dices: [{ count: 2, dice_id: 'd8' }, { count: 1, dice_id: 'd6' }], addon: [{ count: 1, dice_id: 'd6' }] } } })
  items.push({ id: 42, name: 'Длинная формула', nameEn: 'Long Formula', data: { lvl: 1,
    damage: { dices: ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'd6', 'd8', 'd10', 'd12', 'd20'].map(dice_id => ({ count: 2, dice_id })) } } })
}
itemsApi.byIds = async ids => ({ items: items.filter(item => ids.map(Number).includes(item.id)) })
window.rolls = []; window.writes = []; window.events = []
const dice = useDiceStore(pinia)
dice.rollD20 = (title, bonus, mode, options) => { window.bonusFormula = options?.bonus_formula; return window.rolls.push({ title, bonus, mode }) }
dice.roll = (title, expression) => window.rolls.push({ title, expression })
const ctx = reactive({ ownerMode: true, var: { stats: { 4: 3 } },
  characterDerivedEffects: blessingEffects(),
  characterArmor: { state: { castingBlocked: false } },
  characterRolls: { resolve: (mode, context) => {
    window.attackContext = context
    return resolveRollMode(mode, [{ mode: 'disadvantage', source: 'Состояние' }])
  } },
  logSessionEvent: event => window.events.push(event),
})
window.spellCtx = ctx
const value = { schema_version: 2,
  slot_pools: { long_rest: [{ level: 1, total: 2, used: 0 }, { level: 3, total: 1, used: 0 }], short_rest: [{ level: 3, total: 1, used: 0 }] },
  tabs: [{ key: 'wizard', name: 'Волшебник', casting_ability: 4, mode: 'prepared', attack_bonus: 1,
    spells: items.filter(item => item.id !== 7).map(item => ({ key: String(item.id), id: item.id, prepared: item.data.lvl > 0 })) }], grants: [{ key: 'innate:7', id: 7, slotless: true, cast_level: 2, source: { label: 'Дьявольское наследие' } }],
}
const slotScenario = new URLSearchParams(location.search).get('slots')
if (new URLSearchParams(location.search).has('books')) value.tabs.push({ key:'sorcerer',name:'Чародей',casting_ability:6,mode:'known',spells:[] })
if (slotScenario === 'base-only') value.slot_pools = { long_rest: [{ level: 1, total: 2, used: 0 }], short_rest: [{ level: 3, total: 0, used: 0 }] }
if (slotScenario === 'pact-spent') value.slot_pools = { long_rest: [{ level: 1, total: 2, used: 0 }], short_rest: [{ level: 3, total: 1, used: 1 }] }
if (slotScenario === 'rest') value.slot_pools = { long_rest: [{ level: 1, total: 2, used: 2 }, { level: 3, total: 1, used: 1 }], short_rest: [{ level: 3, total: 1, used: 1 }] }
const sheet = reactive({ spells: value, prof_bonus: { v: 3 }, lvl: { level: 5 }, hp: { current: 20, max: 20 } })
window.sheetValues = sheet
// The fixture models the command boundary; production casting is server-authoritative.
window.casts = []
ctx.itemTransfers = { busy: false, state: { loading: false, error: null }, recipients: [], async castSpell(entry, options) {
  window.casts.push({ key: entry.ref.key, ...options })
  if (options.spendSlot) {
    const next = JSON.parse(JSON.stringify(sheet.spells))
    const slot = next.slot_pools[options.pool]?.find(slot => slot.level === options.castLevel)
    if (!slot || slot.used >= slot.total) return false
    slot.used++
    sheet.spells = next
    window.writes.push(next)
  }
  window.events.push({ type: 'spell_used' })
  return true
} }

createApp({ render: () => h('main', { style: 'max-width:900px;margin:16px' }, [
  ...(slotScenario === 'rest' ? [h(DndRest, { block: { id: 'rest', content: {} }, values: sheet,
    'onUpdate:value': (id, next) => { sheet[id] = next },
  })] : []),
  h(DndSpells, {
    block: { id: 'spells', content: { stat_suggest_type_id: 16, prof_bonus_path: 'prof_bonus.v', school_suggest_id: 7 } },
    value: sheet.spells, values: sheet,
    'onUpdate:value': (_, next) => { window.writes.push(next); sheet.spells = next },
  }),
]) }).use(pinia).provide('charCtx', ctx).mount('#app')
