import { LEVEL_CAP } from './levelUp'

export const EXPERIENCE = [
  0, 300, 900, 2700, 6500, 14000, 23000, 34000,
  48000, 64000, 85000, 100000, 120000, 140000, 165000,
  195000, 225000, 265000, 305000, 355000,
]

export function levelExperience(data) {
  const level = Math.max(1, Math.min(LEVEL_CAP, parseInt(data?.level) || 1))
  const nextLevelExp = level < LEVEL_CAP ? EXPERIENCE[level] : null
  const missingExp = nextLevelExp === null ? 0 : Math.max(0, nextLevelExp - (parseInt(data?.exp) || 0))
  return { level, nextLevelExp, missingExp, canLevelUp: nextLevelExp !== null && missingExp === 0 }
}

export function levelUpDraftValues(values, levelData, expFloor) {
  return {
    ...values,
    lvl: {
      ...levelData,
      exp: Math.max(parseInt(levelData?.exp) || 0, expFloor || 0),
    },
  }
}
