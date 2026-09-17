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
const event = reactive({ id: 10, type: 'spell_used', action: 'Урон: Огненный шар', sessionOwnerUserId: 1, createdAt: new Date().toISOString(), data: { source: { itemId: 101, name: 'Огненный шар' }, damageRoll: true, result: { total: 15, parts: [{ kind: 'dice', sides: 6, rolls: [5, 5, 5], n: 3, sum: 15 }], byType: [{ label: 'Огонь', value: 15 }] }, savingThrow: { ability: 2, dc: 15, onSuccess: 'half', results: [] } } })
const targets = [
  { kind: 'character', charUuid: 'hero', name: 'Тиф', hp: { current: 18, max: 24, temp: 3 }, snapshot: { values: { DEX: { value: 16, save_up: true }, lvl: { level: 5 } } } },
  { kind: 'npc', encounterId: 1, npcUid: 'goblin', name: 'Гоблин', hp: { current: 20, max: 20, temp: 2 }, letter: 'Б', color: '#77bb33', snapshot: { item: { stats: { dex: 14 } }, combatant: {} } },
]
const attack = reactive({ id: 11, type: 'dice_roll', action: 'Атака: Посох', sessionOwnerUserId: 1, createdAt: new Date().toISOString(), data: { source: { itemId: 102, name: 'Посох' }, attackRoll: true, result: { total: 18, parts: [{ kind: 'dice', sides: 20, rolls: [15], sum: 15 }, { kind: 'flat', value: 3 }] } } })
if (new URLSearchParams(location.search).has('npc')) {
  delete attack.data.source
  attack.actorName = 'Гоблин'
  attack.actorSvg = '<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" /></svg>'
  attack.data.npcActor = { uid: 'goblin-b', name: 'Гоблин', letter: 'Б', color: '#77bb33' }
}
const attackMode = new URLSearchParams(location.search).has('attack')
window.attackEvent = attack
window.requests = []; window.impactRequests = []; window.attackRequests = []
window.fetch = async (url, options = {}) => {
  if (String(url).includes('/items/by-ids')) return Response.json({ items: [
    { id: 101, name: 'Огненный шар', svg: '<svg viewBox="0 0 20 20"><path d="M10 0L20 20H0Z" /></svg>' },
    { id: 102, name: 'Посох', svg: '<svg viewBox="0 0 20 20"><path d="M10 0V20" /></svg>' },
  ] })
  if (String(url).endsWith('/application-targets')) return Response.json({ targets })
  if (String(url).endsWith('/save-targets')) return Response.json({ targets })
  if (String(url).endsWith('/attack-targets')) {
    const body = JSON.parse(options.body); window.attackRequests.push(body)
    if (window.attackRequests.length === 1) return Response.json({ desc: 'Ошибка сохранения целей' }, { status: 503 })
    attack.data.attackTargets = body.targets
    return Response.json({ event: attack })
  }
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
createApp({ render: () => h('main', { style: 'max-width:700px;margin:20px' }, h(SessionEventRow, { event: attackMode ? attack : event })) }).use(pinia).mount('#app')
