function isSelectable(entry) {
  if (entry?.external_only || entry?.always_prepared || entry?.source || entry?.casting_ability_source) return false
  return !(Array.isArray(entry?.granted_by) && entry.granted_by.length)
}

function belongsToSelection(entry, selection) {
  if (!isSelectable(entry)) return false
  if (entry?.spellcasting_source === selection.sourceKey) return true
  if ((selection.sourceAliases || []).includes(entry?.spellcasting_source)) return true
  return !entry?.spellcasting_source && !!selection.inferUnassigned
}

/** Replace only the editable spell list of one class; grants and other classes stay intact. */
export function applyLevelUpSpellSelection(entries, selection) {
  const current = (Array.isArray(entries) ? entries : []).map((entry) => ({ ...entry }))
  if (!selection?.sourceKey || !Array.isArray(selection.entries)) return current

  const selected = new Map(selection.entries.map((entry) => [String(entry.id), entry]))
  const next = current.filter((entry) => !belongsToSelection(entry, selection) || selected.has(String(entry.id)))

  for (const chosen of selection.entries) {
    const id = chosen.id
    let entry = next.find((candidate) => String(candidate.id) === String(id))
    if (!entry) {
      entry = { id, prepared: !!selection.prepares && Number(chosen.level) > 0 }
      next.push(entry)
    } else if (belongsToSelection(entry, selection)) {
      entry.prepared = !!selection.prepares && Number(chosen.level) > 0
    }
    entry.spellcasting_source = selection.sourceKey
    if (entry.casting_ability_source === 'class') {
      delete entry.casting_ability
      delete entry.casting_ability_source
    }
  }
  return next
}
