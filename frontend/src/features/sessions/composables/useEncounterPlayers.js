import { ensureCombatantLetters, nextTieBreak, setDeep } from '@/features/sessions/lib/encounterHelpers'
import { pvAc, pvAvatar, pvHp, pvName, pvSubtitle } from '@/features/sessions/lib/participantView'

export function useEncounterPlayers({ participants }) {
  function findParticipant(charId) {
    return participants.value.find(x => x.charId === charId)
  }

  function applyLocalPatches(charId, patches) {
    const p = findParticipant(charId)
    if (!p) return
    if (!p.data || typeof p.data !== 'object') p.data = {}
    for (const { path, value } of patches) setDeep(p.data, path, value)
  }

  function getPlayerAva(charId) {
    const p = findParticipant(charId)
    return p ? pvAvatar(p) : null
  }

  function playerDisplayName(c) {
    const p = findParticipant(c.charId)
    if (!p) return 'Игрок ' + c.charId
    return pvName(p) || ('Игрок ' + c.charId)
  }

  function getPlayerAc(charId) {
    const p = findParticipant(charId)
    return p ? pvAc(p) : null
  }

  function getPlayerHp(charId) {
    const p = findParticipant(charId)
    return p ? pvHp(p) : null
  }

  function participantSubtitle(charId) {
    const p = findParticipant(charId)
    return p ? pvSubtitle(p) : ''
  }

  function participantColor(charId) {
    return findParticipant(charId)?.color || null
  }

  function participantToPlayer(p) {
    return {
      uid: 'p-' + p.charId,
      type: 'player',
      charId: p.charId,
      charUuid: p.charUuid,
      position: 'reserve',
      initiative: null,
      surprised: false,
      tieBreak: 0,
    }
  }

  function reconcileParticipants(enc) {
    const participantIds = new Set(participants.value.map(participant => String(participant.charId)))
    const beforeLength = enc.combatants.length
    enc.combatants = enc.combatants.filter(combatant =>
      combatant.type !== 'player' || participantIds.has(String(combatant.charId))
    )
    const known = new Set(enc.combatants
      .filter(combatant => combatant.type === 'player')
      .map(combatant => String(combatant.charId)))
    let added = 0
    for (const p of participants.value) {
      if (!known.has(String(p.charId))) {
        const entry = participantToPlayer(p)
        entry.tieBreak = nextTieBreak(enc.combatants)
        enc.combatants.push(entry)
        known.add(String(p.charId))
        added++
      }
    }
    ensureCombatantLetters(enc.combatants)
    return added > 0 || enc.combatants.length !== beforeLength
  }

  return {
    findParticipant,
    applyLocalPatches,
    getPlayerAva,
    playerDisplayName,
    getPlayerAc,
    getPlayerHp,
    participantSubtitle,
    participantColor,
    reconcileParticipants,
  }
}
