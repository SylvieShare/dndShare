import { nextTieBreak, setDeep } from '@/features/sessions/lib/encounterHelpers'
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
    if (!p) return c.name || ('Игрок ' + c.charId)
    return pvName(p) || c.name || ('Игрок ' + c.charId)
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

  function participantToPlayer(p) {
    const name = pvName(p) || p.templateName || ('Игрок ' + p.charId)
    return {
      uid: 'p-' + p.charId,
      type: 'player',
      charId: p.charId,
      charUuid: p.charUuid,
      name: typeof name === 'string' ? name : String(name),
      position: 'reserve',
      initiative: null,
      surprised: false,
      tieBreak: 0,
    }
  }

  function mergeParticipants(enc) {
    const known = new Set(enc.combatants.map(c => c.uid))
    for (const p of participants.value) {
      if (!known.has('p-' + p.charId)) {
        const entry = participantToPlayer(p)
        entry.tieBreak = nextTieBreak(enc.combatants)
        enc.combatants.push(entry)
      }
    }
  }

  return {
    findParticipant,
    applyLocalPatches,
    getPlayerAva,
    playerDisplayName,
    getPlayerAc,
    getPlayerHp,
    participantSubtitle,
    mergeParticipants,
  }
}
