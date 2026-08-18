export function sourceSkillLabels({ proficiencyIds = [], featureIds = [], expertiseIds = [], labelFor }) {
  const expertise = new Set(expertiseIds.map(String))
  const ids = new Map()

  for (const id of [...proficiencyIds, ...featureIds, ...expertiseIds]) {
    const key = String(id)
    if (!ids.has(key)) ids.set(key, id)
  }

  return [...ids.values()].map((id) => {
    const label = labelFor(id)
    if (!label) return ''
    return expertise.has(String(id)) ? `${label} (Компетентность)` : label
  }).filter(Boolean)
}

export function liveSkillModifier({ abilityMod = 0, proficiencyBonus = 0, skillId, proficiencyIds = [], expertiseIds = [] }) {
  const key = String(skillId)
  const expertise = expertiseIds.some((id) => String(id) === key)
  const proficient = expertise || proficiencyIds.some((id) => String(id) === key)
  const multiplier = expertise ? 2 : proficient ? 1 : 0
  return Number(abilityMod) + Number(proficiencyBonus) * multiplier
}
