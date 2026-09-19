import { collectStatusDefenses, collectStatusDerivedEffects } from '@/features/character-editor/lib/characterStatuses'
import { derivedRollEffects, matchingDerivedEffects } from '@/features/character-editor/lib/characterDerivedEffects'
import { resolveRollMode } from '@/features/character-editor/blocks/dnd/lib/rollMode'
import { encounterEventData } from './encounterEventData'
import { sessionSaveProfile } from './sessionSaveRoll'

export function npcApplicationContext(combatant, npc, items, editable) {
  const data = { ...(npc?.data?.combat || {}), ...(npc?.data?.stats || {}), ...(combatant.override || {}) }
  const states = combatant.effectInstances || []
  const values = { states, hp: { current: combatant.hpCurrent, temp: combatant.hpTemp, max: data.hp } }
  for (const ability of ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']) {
    const value = Number(data[ability.toLowerCase()]) || 10
    const save = (combatant.override?.saving_throws || npc?.data?.saving_throws || {})[ability.toLowerCase()]
    values[ability] = { value, save_bonuses: save == null ? [] : [{ value: Number(save) - Math.floor((value - 10) / 2) }] }
  }
  const effects = collectStatusDerivedEffects(values, items)
  return { ownerMode: editable, values,
    savingThrowBonus: ability => sessionSaveProfile({ kind: 'npc', snapshot: { combatant, item: npc?.data || {} } }, Number(ability), items).bonus,
    actor: { name: data.name || npc?.name || 'НПС', charUuid: null, itemId: combatant.itemId || null },
    eventData: encounterEventData(combatant, data.name || npc?.name || 'НПС'),
    characterDefenses: { defenses: [...collectStatusDefenses(values, items), ...(npc?.data?.damage_resistances || []).map(id => ({ damage_type: Number(id), kind: 'resistance' })), ...(npc?.data?.damage_immunities || []).map(id => ({ damage_type: Number(id), kind: 'immunity' }))] },
    characterRolls: { resolve: (mode, context) => resolveRollMode(mode, derivedRollEffects(effects, context)) },
    characterDerivedEffects: {
      rollBonusOptions: context => matchingDerivedEffects(effects, 'roll_bonus', context).filter(row => row.formula),
      rollBonus: (context, excluded = []) => matchingDerivedEffects(effects, 'roll_bonus', context).filter(row => !excluded.includes(row.key)).map(row => row.formula).join('+'),
    },
    updateValues(patch) { if (patch.states) combatant.effectInstances = patch.states; if (patch.hp) { combatant.hpCurrent = patch.hp.current; combatant.hpTemp = patch.hp.temp } },
  }
}
