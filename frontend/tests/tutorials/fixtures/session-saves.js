import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import SessionEventRow from '../../../src/features/sessions/components/SessionEventRow.vue'
import { useAccountStore } from '../../../src/stores/account'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import { useSuggestStore } from '../../../src/stores/suggest'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const pinia = createPinia()
useAccountStore(pinia).user = { id: 1 }
useSuggestStore(pinia).set(3, [])
const event = reactive({ id: 10, type: 'spell_used', action: 'Огненный шар', sessionOwnerUserId: 1, createdAt: new Date().toISOString(), data: { savingThrow: { ability: 2, dc: 15, onSuccess: 'half', results: [] } } })
const targets = [
  { kind: 'character', charUuid: 'hero', name: 'Тиф', snapshot: { values: { DEX: { value: 16, save_up: true }, lvl: { level: 5 } } } },
  { kind: 'npc', encounterId: 1, npcUid: 'goblin', name: 'Гоблин', letter: 'Б', color: '#77bb33', snapshot: { item: { stats: { dex: 14 } }, combatant: {} } },
]
window.requests = []
window.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/save-targets')) return Response.json({ targets })
  if (String(url).endsWith('/saves')) {
    const body = JSON.parse(options.body); window.requests.push(body)
    if (window.requests.length === 1) return Response.json({ desc: 'Ошибка связи' }, { status: 503 })
    event.data.savingThrow.results = body.results.map(row => ({ ...row, key: row.target.charUuid || row.target.npcUid, success: row.result.total >= 15 }))
    return Response.json({ event })
  }
  return Response.json({ items: [], events: [] })
}
const events = useSessionEventsStore(pinia)
events.sessionUuid = 'session'; events.refresh = async () => {}
createApp({ render: () => h('main', { style: 'max-width:700px;margin:20px' }, h(SessionEventRow, { event })) }).use(pinia).mount('#app')
