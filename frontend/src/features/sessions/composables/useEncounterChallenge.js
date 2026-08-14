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
  selectedUids,
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
  const selectedChallengeCombatants = computed(() =>
    inCombat.value.filter(combatant => selectedUids.value.has(combatant.uid))
  )
  const selectedChallengeCount = computed(() => selectedChallengeCombatants.value.length)

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
    const combatants = selectedChallengeCombatants.value
    if (!combatants.length) return
    const key = normalizedAbility(ability)
    const meta = abilityMeta(key)
    const results = {}
    const diceStore = useDiceStore()

    for (const combatant of combatants) {
      const bonus = bonusFor(combatant, key, savingThrow)
      const kind = savingThrow ? 'спасбросок' : 'проверка'
      const roll = diceStore.roll(
        `${displayName(combatant)} — ${meta.label.toLowerCase()}, ${kind}`,
        d20Expr(bonus),
        { crit_mode: true, popup: false },
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

  function rerollChallenge(combatant, mode) {
    const currentChallenge = challenge.value
    const currentResult = currentChallenge?.results?.[combatant.uid]
    if (!currentResult || !['advantage', 'disadvantage'].includes(mode)) return

    const keepHigh = mode === 'advantage'
    const previous = Number(currentResult.roll) || 0
    const extra = Math.floor(Math.random() * 20) + 1
    const keepPrevious = keepHigh ? previous >= extra : previous <= extra
    const kept = keepPrevious ? previous : extra
    const droppedIdx = keepPrevious ? 1 : 0
    const bonus = Number(currentResult.bonus) || 0
    const total = kept + bonus
    const meta = abilityMeta(currentChallenge.ability)
    const kind = currentChallenge.savingThrow ? 'Спасбросок' : 'Проверка'
    const modeLabel = keepHigh ? 'с преимуществом' : 'с помехой'
    const parts = [{
      sign: '+',
      kind: 'dice',
      n: 2,
      sides: 20,
      rolls: [previous, extra],
      sum: kept,
      dropped: [droppedIdx],
      label: null,
      color: null,
    }]
    if (bonus) {
      parts.push({
        sign: bonus < 0 ? '-' : '+',
        kind: 'flat',
        value: Math.abs(bonus),
        sum: Math.abs(bonus),
        label: null,
        color: null,
      })
    }

    useDiceStore().pushEntry({
      title: `${displayName(combatant)} — ${kind} ${meta.label.toLowerCase()} ${modeLabel}`,
      popup: false,
      outcome: kept === 20
        ? { kind: 'crit', sides: 20, value: kept }
        : kept === 1
          ? { kind: 'fumble', sides: 20, value: kept }
          : null,
      result: {
        parts,
        total,
        byType: [{ label: null, color: null, value: total }],
        expression: `2d20${keepHigh ? 'kh' : 'kl'}${bonus ? d20Expr(bonus).slice(3) : ''}`,
      },
    })

    encounter.value = {
      ...encounter.value,
      challenge: {
        ...currentChallenge,
        results: {
          ...currentChallenge.results,
          [combatant.uid]: {
            roll: kept,
            bonus,
            total,
            revision: (Number(currentResult.revision) || 0) + 1,
          },
        },
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
    selectedChallengeCount,
    challengeAbilities: ENCOUNTER_CHALLENGE_ABILITIES,
    challengeAbilityMeta: abilityMeta,
    challengeResult,
    runChallenge,
    rerollChallenge,
    resetChallenge,
  }
}
