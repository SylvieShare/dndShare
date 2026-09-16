import { impactTargetKey } from '../../../src/features/sessions/lib/sessionImpact'
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
const event = reactive({ id: 10, type: 'spell_used', action: 'Огненный шар', sessionOwnerUserId: 1, createdAt: new Date().toISOString(), data: { damageRoll: true, result: { total: 15, parts: [{ kind: 'dice', sides: 6, rolls: [5, 5, 5], n: 3, sum: 15 }], byType: [{ label: 'Огонь', value: 15 }] }, savingThrow: { ability: 2, dc: 15, onSuccess: 'half', results: [] } } })
const targets = [
  { kind: 'character', charUuid: 'hero', name: 'Тиф', hp: { current: 18, max: 24, temp: 3 }, snapshot: { values: { DEX: { value: 16, save_up: true }, lvl: { level: 5 } } } },
  { kind: 'npc', encounterId: 1, npcUid: 'goblin', name: 'Гоблин', hp: { current: 20, max: 20, temp: 2 }, letter: 'Б', color: '#77bb33', snapshot: { item: { stats: { dex: 14 } }, combatant: {} } },
]
window.requests = []; window.impactRequests = []
window.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/application-targets')) return Response.json({ targets })
  if (String(url).endsWith('/save-targets')) return Response.json({ targets })
  if (String(url).endsWith('/impacts')) {
    const body = JSON.parse(options.body); window.impactRequests.push(body)
    if (window.impactRequests.length === 1) return Response.json({ desc: 'Повторите запрос' }, { status: 503 })
    event.data.impacts ||= []
    for (const row of body.targets) if (!event.data.impacts.some(v => v.key === impactTargetKey(row.target))) {
      const total = row.outcome === 'success' ? 7 : 15
      event.data.impacts.push({ key: impactTargetKey(row.target), target: row.target, before: { current: 20, max: 20, temp: 2 }, after: { current: 22 - total, max: 20, temp: 0 }, total, absorbed: 2, hpLost: total - 2, damage: [{ amount: 15, applied: total, label: 'Огонь' }] })
    }
    return Response.json({ event })
  }
  if (String(url).endsWith('/saves')) {
    const body = JSON.parse(options.body); window.requests.push(body)
    if (window.requests.length === 1) return Response.json({ desc: 'Ошибка связи' }, { status: 503 })
    event.data.savingThrow.results = body.results.map(row => ({ ...row, key: impactTargetKey(row.target), success: row.result.total >= 15 }))
    return Response.json({ event })
  }
  return Response.json({ items: [], events: [] })
}
const events = useSessionEventsStore(pinia)
events.sessionUuid = 'session'; events.refresh = async () => {}
createApp({ render: () => h('main', { style: 'max-width:700px;margin:20px' }, h(SessionEventRow, { event })) }).use(pinia).mount('#app')
