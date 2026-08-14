import { computed } from 'vue'
import {
  abilityModifier,
  d20Expr,
  proficiencyBonus,
  resolveNumValue,
  sumBonuses,
} from '@/shared/lib/dnd'
import { useDiceStore } from '@/stores/dice'

export const ENCOUNTER_CHALLENGE_ABILITIES = [
  { value: 'STR', label: 'Сила', short: 'СИЛ' },
  { value: 'DEX', label: 'Ловкость', short: 'ЛОВ' },
  { value: 'CON', label: 'Телосложение', short: 'ТЕЛ' },
  { value: 'INT', label: 'Интеллект', short: 'ИНТ' },
  { value: 'WIS', label: 'Мудрость', short: 'МДР' },
  { value: 'CHA', label: 'Харизма', short: 'ХАР' },
]

const ABILITY_KEYS = new Set(ENCOUNTER_CHALLENGE_ABILITIES.map(item => item.value))

function normalizedAbility(ability) {
  const key = String(ability || '').toUpperCase()
  return ABILITY_KEYS.has(key) ? key : 'DEX'
}

function playerProficiency(values) {
  const stored = values?.prof_bonus || {}
  const level = Number(values?.lvl?.level) || 1
  const base = stored.auto === false
    ? Number(stored.v) || 0
    : proficiencyBonus(level)
  return base + sumBonuses(stored.bonuses)
}

export function playerChallengeBonus(participant, ability, savingThrow = false) {
  const values = participant?.data?.values || {}
  const stat = values[normalizedAbility(ability)] || {}
  const score = stat.value == null ? 10 : resolveNumValue(stat.value)
  let bonus = abilityModifier(score)
  if (savingThrow) {
    if (stat.save_up) bonus += playerProficiency(values)
    bonus += sumBonuses(stat.save_bonuses)
  }
  return bonus
}

export function npcChallengeBonus(score, explicitSave, savingThrow = false) {
  if (savingThrow && explicitSave != null && explicitSave !== '') {
    return Number(explicitSave) || 0
  }
  const normalizedScore = score == null || score === '' ? 10 : Number(score)
  return abilityModifier(Number.isFinite(normalizedScore) ? normalizedScore : 10)
}

export function useEncounterChallenge({
  encounter,
  inCombat,
  findParticipant,
  playerDisplayName,
  npcName,
  npcAbilityScore,
  npcSavingThrow,
}) {
  const challenge = computed(() => {
    const value = encounter.value.challenge
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    if (!value.results || typeof value.results !== 'object' || Array.isArray(value.results)) return null
    return value
  })

  const challengeActive = computed(() => !!challenge.value)

  function abilityMeta(ability = challenge.value?.ability) {
    const key = normalizedAbility(ability)
    return ENCOUNTER_CHALLENGE_ABILITIES.find(item => item.value === key)
  }

  function bonusFor(combatant, ability, savingThrow) {
    const key = normalizedAbility(ability)
    if (combatant.type === 'player') {
      return playerChallengeBonus(findParticipant(combatant.charId), key, savingThrow)
    }
    return npcChallengeBonus(
      npcAbilityScore(combatant, key),
      npcSavingThrow(combatant, key),
      savingThrow,
    )
  }

  function displayName(combatant) {
    return combatant.type === 'player'
      ? playerDisplayName(combatant)
      : npcName(combatant)
  }

  function runChallenge({ ability, savingThrow = false }) {
    const key = normalizedAbility(ability)
    const meta = abilityMeta(key)
    const results = {}
    const diceStore = useDiceStore()

    for (const combatant of inCombat.value) {
      const bonus = bonusFor(combatant, key, savingThrow)
      const kind = savingThrow ? 'спасбросок' : 'проверка'
      const roll = diceStore.roll(
        `${displayName(combatant)} — ${meta.label.toLowerCase()}, ${kind}`,
        d20Expr(bonus),
        { crit_mode: true },
      )
      const natural = roll?.parts
        ?.find(part => part.kind === 'dice' && part.sides === 20)
        ?.rolls?.[0]
      results[combatant.uid] = {
        roll: Number(natural) || 0,
        bonus,
        total: Number(roll?.total) || 0,
      }
    }

    encounter.value = {
      ...encounter.value,
      challenge: {
        ability: key,
        savingThrow: !!savingThrow,
        results,
      },
    }
  }

  function resetChallenge() {
    const { challenge: _challenge, ...rest } = encounter.value
    encounter.value = rest
  }

  function challengeResult(combatant) {
    return challenge.value?.results?.[combatant.uid] || null
  }

  return {
    challenge,
    challengeActive,
    challengeAbilities: ENCOUNTER_CHALLENGE_ABILITIES,
    challengeAbilityMeta: abilityMeta,
    challengeResult,
    runChallenge,
    resetChallenge,
  }
}
