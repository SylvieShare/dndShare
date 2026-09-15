import { normalizedEncounterLetter, SIDE_COLOR, sideOf } from './encounterHelpers'

export function encounterEventData(combatant, name) {
  if (combatant?.type !== 'npc') return {}
  return { npcActor: {
    uid: combatant.uid, name,
    letter: normalizedEncounterLetter(combatant.markerLetter),
    color: combatant.iconColor || SIDE_COLOR[sideOf(combatant)],
  } }
}
