import { STAT_FULL, STAT_SHORT, SUGGEST16_TO_STAT } from '@/shared/lib/dndStats'
import { dieLabel } from '@/shared/lib/systemDice'
import {
  CLASS_ITEM_TYPE,
  RACE_ITEM_TYPE,
  SUBCLASS_ITEM_TYPE,
  SUBRACE_ITEM_TYPE,
  itemReferenceId,
  itemReferenceIds,
} from '@/shared/lib/dndItemTypes'

export function originKind(typeId) {
  return ({
    [RACE_ITEM_TYPE]: 'race',
    [SUBRACE_ITEM_TYPE]: 'subrace',
    [CLASS_ITEM_TYPE]: 'class',
    [SUBCLASS_ITEM_TYPE]: 'subclass',
  })[Number(typeId)] || ''
}

export function originKindLabel(typeId) {
  return ({ race: 'раса', subrace: 'подраса', class: 'класс', subclass: 'подкласс' })[originKind(typeId)] || ''
}

export function originParentId(item) {
  const kind = originKind(item?.typeId)
  if (kind === 'subrace') return itemReferenceId(item?.data?.race)
  if (kind === 'subclass') return itemReferenceId(item?.data?.class)
  return null
}

export function originRelationIds(item) {
  const kind = originKind(item?.typeId)
  if (kind === 'race') return itemReferenceIds(item?.data?.subraces)
  if (kind === 'class') return itemReferenceIds(item?.data?.subclasses)
  const parentId = originParentId(item)
  return parentId == null ? [] : [parentId]
}

export function abilityNames(ids, { short = false } = {}) {
  const labels = short ? STAT_SHORT : STAT_FULL
  return [...new Set((Array.isArray(ids) ? ids : [])
    .map(id => labels[SUGGEST16_TO_STAT[Number(id)]])
    .filter(Boolean))]
}

export function asiLabel(data, { short = true } = {}) {
  const labels = short ? STAT_SHORT : STAT_FULL
  const fixed = (Array.isArray(data?.asi) ? data.asi : [])
    .map(entry => {
      const stat = labels[SUGGEST16_TO_STAT[Number(entry?.ability)]]
      const bonus = Number(entry?.bonus)
      return stat && Number.isFinite(bonus) ? `${stat} ${bonus >= 0 ? '+' : ''}${bonus}` : ''
    })
    .filter(Boolean)
  const choice = data?.asi_choice
  if (choice && Number(choice.count) > 0 && Number(choice.bonus)) {
    fixed.push(`+${Number(choice.bonus)} к ${Number(choice.count)} на выбор`)
  }
  return fixed.join(' · ')
}

export function hitDieLabel(data) {
  return dieLabel(data?.hit_die) || '—'
}

export function plainOriginDescription(item, limit = 180) {
  const source = item?.data?.short_description || item?.data?.summary || item?.data?.description || ''
  const text = String(source)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
  if (text.length <= limit) return text
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`
}

export function spellcastingLabel(data) {
  const spellcasting = data?.spellcasting || {}
  const progression = data?.caster_progression || spellcasting.progression
  if (progression) {
    return ({ full: 'Полный', half: 'Половина', halfup: 'Половина ↑', third: 'Треть', pact: 'Магия договора' })[progression] || progression
  }
  if (spellcasting.ability || data?.spellcasting_ability) return 'Заклинатель'
  return 'Без магии'
}
