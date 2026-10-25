import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import { useAccountStore } from '../../../src/stores/account'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import { useDiceStore } from '../../../src/stores/dice'
import { useEncounterChallenge } from '../../../src/features/sessions/composables/useEncounterChallenge'
import AppNotifications from '../../../src/features/notifications/components/AppNotifications.vue'
import EncounterChallengeResult from '../../../src/features/sessions/components/EncounterChallengeResult.vue'
import SessionSavingThrow from '../../../src/features/sessions/components/SessionSavingThrow.vue'
import SessionRollSequence from '../../../src/features/sessions/components/SessionRollSequence.vue'
import { fetchGet } from '../../../src/shared/api/http'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia(), events = useSessionEventsStore(pinia), dice = useDiceStore(pinia)
useAccountStore(pinia).user = { id: 1 }
events.sessionUuid = 'game'; events.actorCharUuid = 'hero'
window.published = []
events.publish = async event => { window.published.push(event) }
const saveEvent = reactive({ id: 1, sessionOwnerUserId: 1, data: { savingThrow: { ability: 2, dc: 15, results: [] } } })
const sequenceEvent = reactive({ id: 2, sessionOwnerUserId: 1, data: { sequence: {
  attackBonus: 3, damageExpression: '2d6+3', criticalExpression: '4d6+3', revision: 0,
  hits: [{ status: 'target' }],
} } })
events.refresh = async () => {
  const response = await fetchGet('/sessions/game/events')
  for (const event of response.events || []) Object.assign(event.id === 1 ? saveEvent : sequenceEvent, event)
}
const npc = { uid: 'goblin', type: 'npc' }, encounter = ref({ combatants: [npc] })
window.pendingDiceFixture = { events, dice, encounter }
createApp({
  setup() {
    const challenge = useEncounterChallenge({ encounter, selectedUids: ref(new Set(['goblin'])),
      findParticipant: () => null, playerDisplayName: () => '', npcName: () => 'Гоблин',
      npcAbilityScore: () => 14, npcSavingThrow: () => null })
    return () => h('main', { style: 'padding:16px;max-width:760px;display:grid;gap:24px' }, [
      h('button', { onClick: () => dice.rollD20('Атака', 3, 'normal', { roll_kind: 'attack', crit_mode: true }) }, 'Бросить атаку'),
      h('button', { onClick: () => challenge.runChallenge({ ability: 'DEX' }) }, 'Начать испытание'),
      challenge.challengeResult(npc) && h(EncounterChallengeResult, {
        result: challenge.challengeResult(npc), challenge: challenge.challenge.value,
        ability: challenge.challengeAbilityMeta(), busy: challenge.challengeBusy.value,
        onReroll: mode => challenge.rerollChallenge(npc, mode),
      }),
      h(SessionSavingThrow, { event: saveEvent }),
      h(SessionRollSequence, { event: sequenceEvent, isDm: true }),
      h(AppNotifications),
    ])
  },
}).use(pinia).mount('#app')
