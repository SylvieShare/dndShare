const kinds = { 3: 'armor_proficiency', 4: 'weapon_proficiency', 5: 'tool_proficiency', 6: 'language_proficiency' }
export const proficiencyDictionaries = { 'Доспехи': 3, 'Оружие': 4, 'Инструменты': 5, 'Языки': 6 }

export function grantedTags(dictionaryId, dictionary, grants) {
  if (!kinds[dictionaryId]) return []
  const rows = grants?.(kinds[dictionaryId]) || []
  const labels = new Map((dictionary || []).map(row => [String(row.id), row.value]))
  return rows.map(row => labels.get(String(row.targetId))).filter(Boolean)
}
