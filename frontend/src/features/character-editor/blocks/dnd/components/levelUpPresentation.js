import { STAT_SHORT } from '@/shared/lib/dndStats'
import { dieFaceOf, MULTICLASS_REQS } from '@/features/character-editor/blocks/dnd/lib/levelUp'

export function monogram(name) {
  return String(name || '?').trim().charAt(0).toUpperCase()
}

export function featSnippet(feature) {
  const raw = feature?.data?.desc || ''
  const text = String(raw).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 180 ? text.slice(0, 177).trim() + '…' : text
}

export function multiclassPrerequisiteLabel(item) {
  const key = String(item?.nameEn || '').trim().toLowerCase()
  const groups = MULTICLASS_REQS[key] || []
  return groups
    .map((alternatives) => alternatives.map((stat) => `${STAT_SHORT[stat]} 13`).join(' или '))
    .join(' и ')
}

export function hitDieLabel(item, labelForDie) {
  const id = item?.data?.hit_die
  const label = labelForDie(id)
  const face = dieFaceOf(label)
  return face ? `d${face}` : ''
}
