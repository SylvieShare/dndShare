import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import SessionSettingsWorkspace from '../../../src/features/sessions/components/SessionSettingsWorkspace.vue'
import InputText from '../../../src/features/character-editor/blocks/generic/InputText.vue'
import { useSessionSettings } from '../../../src/features/sessions/composables/useSessionSettings'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import { useDiceStore } from '../../../src/stores/dice'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia(), session = ref({ settings: { players: {}, combat: {}, interactions: {}, autoAccept: {}, karmicDice: { enabled: false, separate: false } } })
const playerIcon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#6d68b7"/><circle cx="24" cy="17" r="8" fill="#dad8ee"/><path d="M10 39a14 14 0 0128 0" fill="#dad8ee"/></svg>')
function probabilities(balance) {
  const weights = Array.from({ length: 20 }, (_, index) => 1 + .85 * balance / 6 * (2 * index / 19 - 1))
  const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map(value => value / total)
}
window.requests = []; window.scales = []; window.failedRead = false
window.fetch = async (url, options = {}) => {
  if (String(url).endsWith('/settings')) {
    const body = JSON.parse(options.body); window.requests.push(body); window.scales = []
    return new Response(null, { status: 204 })
  }
  if (String(url).endsWith('/karmic-dice')) return window.failedRead
    ? Response.json({ desc: 'Ошибка чтения' }, { status: 503 }) : Response.json({ scales: window.scales.map(scale => ({ ...scale, probabilities: probabilities(scale.balance), ...(scale.key.startsWith('char:') ? { imageUrl: playerIcon } : {}) })) })
  if (String(url).endsWith('/d20')) {
    const body = JSON.parse(options.body); window.requests.push(body)
    const separate = session.value.settings.karmicDice.separate
    const key = separate ? 'char:hero' : 'shared'
    const before = window.scales.find(row => row.key === key)?.balance || 0
    window.scales = [{ key, name: separate ? 'Герой' : 'Общая шкала', balance: before + 0.7 }]
    return Response.json({ rolls: [4], karmic: true, balanceBefore: before, balanceAfter: before + 0.7 })
  }
  return Response.json({})
}
const events = useSessionEventsStore(pinia)
events.sessionUuid = 'session'; events.actorCharUuid = 'hero'; events.publish = async () => {}
const dice = useDiceStore(pinia)
createApp({
  setup() {
    const state = useSessionSettings({ sessionUuid: 'session', session })
    const name = ref('Оченьдлинноеимябезпробелов'.repeat(5))
    return () => h('main', { style: 'padding:16px;max-width:760px;margin:auto' }, [
      h('div', { style: 'width:250px', 'data-testid': 'long-name' }, h(InputText, { block: { id: 'name', content: {} }, value: name.value, 'onUpdate:value': (_, value) => { name.value = value } })),
      h(SessionSettingsWorkspace, { sessionUuid: 'session', settings: state.settings, saving: state.saving.value, error: state.error.value, 'onUpdate-setting': state.update }),
      h('button', { onClick: () => dice.rollD20('Атака', 2, 'normal', { roll_kind: 'attack' }) }, 'Бросить атаку'),
    ])
  },
}).use(pinia).provide('charCtx', { ownerMode: true }).mount('#app')
