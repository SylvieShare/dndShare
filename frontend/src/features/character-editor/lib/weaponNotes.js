import { magicItemActive } from './characterMagicItems'

export function visibleWeaponNotes(item, entry, equipped = true, values) {
  if (!item || !entry || entry.params?.magic?.lost || entry.params?.creation?.expired || Number(entry.count ?? 1) <= 0) return []
  return (item.data?.weapon_notes || []).filter(note => {
    if (!note.title || !note.description) return false
    if (note.when === 'always') return true
    if (note.when === 'attuned') return !!entry.params?.magic?.attuned
    if (note.when === 'active') return Number(item.typeId) === 19 ? magicItemActive(item, entry, equipped, values) : equipped
    return false
  })
}
