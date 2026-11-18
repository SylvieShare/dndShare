import { ref, shallowRef } from 'vue'
import { applySessionImpact, getSaveTargets } from '@/shared/api/sessionEventsApi'
import { useSessionEventsStore } from '@/stores/sessionEvents'
import { pvHpPath } from '../lib/participantView'
import { targetIdentity } from '../lib/sessionImpact'

export function useEncounterImpacts({ sessionUuid, persistence, findParticipant, applyLocalPatches, predictHp }) {
  const busy = ref(false)
  const error = ref('')
  const canRetry = ref(false)
  const preview = shallowRef(new Map())
  let pending = null

  async function prepareRequest(operation) {
    await persistence.flushSave()
    if (persistence.saveError.value || persistence.loadError.value)
      throw new Error('Не удалось сохранить бой перед применением урона.')
    const targets = (await getSaveTargets(sessionUuid)).targets || []
    return {
      clientActionId: crypto.randomUUID(),
      amount: operation.amount,
      targets: operation.combatants.map(combatant => {
        const target = targets.find(row => combatant.type === 'npc'
          ? row.kind === 'npc' && row.npcUid === combatant.uid
          : row.charUuid === findParticipant(combatant.charId)?.charUuid)
        if (!target) throw Object.assign(new Error('Цель больше не доступна в сессии.'), { status: 404 })
        return { target: targetIdentity(target) }
      }),
    }
  }

  function showCommittedResult(operation, response) {
    const updated = new Map()
    for (const { target, after } of response.event?.data?.impacts || []) {
      const actor = operation.combatants.find(row => row.type === 'npc'
        ? row.uid === target.npcUid
        : findParticipant(row.charId)?.charUuid === target.charUuid)
      if (!actor) continue
      if (actor.type === 'npc') {
        updated.set(actor.uid, { current: after.current, temp: after.temp })
        continue
      }
      const participant = findParticipant(actor.charId)
      const path = pvHpPath(participant)
      if (!path) continue
      const patches = [{ path: `${path}.current`, value: after.current }]
      if (participant.data?.system !== 'cyberpunk-red') patches.push({ path: `${path}.temp`, value: after.temp })
      applyLocalPatches(actor.charId, patches)
    }
    preview.value = updated
  }

  async function synchronize(operation) {
    busy.value = true
    error.value = ''
    canRetry.value = false
    try {
      if (!operation.committed) {
        operation.request ??= await prepareRequest(operation)
        const response = await applySessionImpact(sessionUuid, operation.request)
        operation.committed = true
        showCommittedResult(operation, response)
        void useSessionEventsStore().refresh().catch(() => {})
      }
      if (operation.combatants.some(row => row.type === 'npc')) await persistence.reconcile()
      preview.value = new Map()
      pending = null
    } catch (cause) {
      if (!operation.committed) preview.value = new Map()
      // A network failure can hide a successful commit. Retain its action ID for retry.
      if (!operation.committed && cause.status >= 400 && cause.status < 500) pending = null
      canRetry.value = !!pending
      error.value = cause.message || 'Не удалось синхронизировать урон.'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function applyCombatDamage(combatants, amount) {
    if (busy.value) throw new Error('Дождитесь подтверждения предыдущего урона.')
    const signature = JSON.stringify({ uids: combatants.map(row => row.uid).sort(), amount })
    if (pending && pending.signature !== signature)
      throw new Error('Сначала повторите синхронизацию предыдущего урона.')
    if (!pending) {
      pending = { signature, combatants, amount, request: null, committed: false }
      const predictions = new Map()
      for (const actor of combatants) {
        const hp = predictHp(actor, amount)
        if (hp) predictions.set(actor.uid, { current: hp.current, temp: hp.temp })
      }
      preview.value = predictions
    }
    await synchronize(pending)
  }

  async function retry() {
    if (!busy.value && pending) await synchronize(pending).catch(() => {})
    else if (!pending) error.value = ''
  }

  return { applyCombatDamage, busy, error, canRetry, retry, previewHp: uid => preview.value.get(uid) }
}
