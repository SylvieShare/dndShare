import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import DndSpells from '../../../src/features/character-editor/blocks/dnd/DndSpells.vue'
import { useSuggestStore } from '../../../src/stores/suggest'
import { useTemplateStore } from '../../../src/stores/template'
import { itemsApi } from '../../../src/shared/api/itemsApi'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const pinia = createPinia()
useTemplateStore(pinia).templates = [{ id: 1, name: 'DND5' }]
useSuggestStore(pinia).set(16, [{ id: 4, value: 'Интеллект' }]); useSuggestStore(pinia).set(7, []); useSuggestStore(pinia).set(12, [])
const items = [
  { id: 548, name: 'Благословение', typeId: 5, data: { lvl: 1, concentration: true, application_targets: { count: 3, per_slot: 1 }, status_effects: [{ key: 'bless', effect: { id: 1 } }] } },
  { id: 601, name: 'Лечащее слово', typeId: 5, data: { lvl: 1, heal: { add_mod: true, scaling: 'slot', dices: [{ count: 1, dice_id: 'd4' }], addon: [{ count: 1, dice_id: 'd4' }] } } },
]
itemsApi.byIds = async ids => ({ items: items.filter(item => ids.map(Number).includes(item.id)) })
window.casts = []
const ctx = reactive({ ownerMode: true, var: { stats: { 4: 3 } }, topSession: location.search.includes('offline') ? null : { uuid: 'session' },
  itemTransfers: { busy: false, state: { settings: {}, loading: false }, recipients: [{ charUuid: 'ally', templateId: 1, name: 'Торин', data: { values: { name: 'Торин' } } }], loadPlayers() {},
    async castSpell(entry, options) {
      window.casts.push({ id: entry.item.id, ...options })
      if (options.spendSlot) sheet.spells.slot_pools[options.pool].find(slot => slot.level === options.castLevel).used++
      return true
    },
  },
})
const sheet = reactive({ spells: { schema_version: 2, tabs: [{ key: 'wizard', name: 'Волшебник', casting_ability: 4, spells: items.map(item => ({ id: item.id, key: String(item.id), prepared: true })) }], slot_pools: { long_rest: [{ level: 1, total: 2, used: 0 }, { level: 2, total: 1, used: 1 }, { level: 3, total: 1, used: 0 }], short_rest: [{ level: 3, total: 1, used: 0 }] } } })
createApp({ render: () => h('main', { style: 'padding:16px;max-width:800px' }, [h(DndSpells, {
  block: { id: 'spells', content: { stat_suggest_type_id: 16, prof_bonus_path: 'prof_bonus.v', school_suggest_id: 7 } },
  values: sheet, value: sheet.spells, 'onUpdate:value': (_, next) => { sheet.spells = next },
})]) }).use(pinia).provide('charCtx', ctx).mount('#app')
