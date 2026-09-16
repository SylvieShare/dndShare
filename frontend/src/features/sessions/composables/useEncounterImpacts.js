import { pvHpPath } from '../lib/participantView'
import { ref } from 'vue'
import { applySessionImpact, getSaveTargets } from '@/shared/api/sessionEventsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { targetIdentity } from '../lib/sessionImpact'

export function useEncounterImpacts({ sessionUuid, persistence, load, findParticipant, applyLocalPatches }) {
  const busy = ref(false)
  let pending = null
  async function applyCombatDamage(combatants, amount) {
    if (busy.value) throw new Error('Дождитесь применения урона.')
    busy.value = true
    try {
      const signature = JSON.stringify({ uids: combatants.map(row => row.uid).sort(), amount })
      if (pending && pending.signature !== signature) throw new Error('Сначала повторите предыдущее применение урона: его результат ещё не подтверждён.')
      if (!pending) {
        await persistence.flushSave()
        if (persistence.saveError.value || persistence.loadError.value) throw new Error('Не удалось сохранить бой перед применением урона.')
        const targets = (await getSaveTargets(sessionUuid)).targets || []
        const selected = combatants.map(combatant => {
          const target = targets.find(row => combatant.type === 'npc' ? row.kind === 'npc' && row.npcUid === combatant.uid : row.charUuid === findParticipant(combatant.charId)?.charUuid)
          if (!target) throw new Error('Цель больше не доступна в сессии.')
          return { target: targetIdentity(target) }
        })
        pending = { signature, request: { clientActionId: crypto.randomUUID(), amount, targets: selected } }
      }
      const response = await applySessionImpact(sessionUuid, pending.request)
      for (const impact of response.event?.data?.impacts || []) {
        const combatant = combatants.find(row => row.type === 'player' && findParticipant(row.charId)?.charUuid === impact.target.charUuid)
        const path = combatant && pvHpPath(findParticipant(combatant.charId))
        if (path) applyLocalPatches(combatant.charId, [{ path: `${path}.current`, value: impact.after.current }, { path: `${path}.temp`, value: impact.after.temp }])
      }
      pending = null
      await load()
      await useSessionEventsStore().refresh()
    } finally { busy.value = false }
  }
  return { applyCombatDamage, busy }
}
