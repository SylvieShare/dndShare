import { abilityOwnerLevel, abilityHasResources } from '@/shared/lib/dndAbilityUses'
import { choiceSelectionsComplete } from '@/features/items/lib/itemChoices'
import { makeUid } from '@/features/character-editor/blocks/dnd/lib/itemEntry'

const rows = value => Array.isArray(value) ? value : []
const id = value => String(value?.id ?? value ?? '')
export const selectionParentId = item => id(item?.data?.selection_parent_id)
export const isSelectedAbility = item => !!selectionParentId(item)

export function abilitySelectionCount(parent, level) {
  if (level < Number(parent?.data?.level || 1)) return 0
  const rule = rows(parent?.data?.ability_selection?.counts)
    .filter(row => Number(row.level) <= level).sort((a, b) => Number(b.level) - Number(a.level))[0]
  return Math.max(0, Number(rule?.count) || 0)
}

export function selectedAbilityEntries(values, parent, items) {
  const map = new Map(items.map(item => [id(item.id), item]))
  return rows(values?.abilities_class).filter(entry => (
    id(entry.selection_source) === id(parent.id)
    || selectionParentId(map.get(id(entry.id))) === id(parent.id)
  ))
}

export function selectedAbilityEligibility(item, parent, values) {
  const reasons = []
  if (selectionParentId(item) !== id(parent.id)) reasons.push('Другой набор способностей')
  const level = abilityOwnerLevel(parent.data, values)
  if (level < Number(item?.data?.level || 1)) reasons.push(`Уровень класса: ${item.data.level}`)
  const knownSpells = new Set([
    ...rows(values?.spells?.tabs).flatMap(tab => rows(tab.spells)),
    ...rows(values?.spells?.grants),
  ].map(entry => id(entry.id)))
  for (const spell of rows(item?.data?.selection_requirements?.spells)) {
    if (!knownSpells.has(id(spell))) reasons.push(`Требуется заклинание: ${spell.name || `#${id(spell)}`}`)
  }
  for (const requirement of rows(item?.data?.selection_requirements?.choices)) {
    const entry = rows(values?.abilities_class).find(entry => id(entry.id) === id(requirement.item_id))
    if (!rows(entry?.choices?.[requirement.key]).some(value => rows(requirement.values).map(String).includes(String(value)))) {
      reasons.push(requirement.label || `Требуется выбор: ${rows(requirement.values).join(', ')}`)
    }
  }
  return { eligible: !reasons.length, reasons }
}

export function abilitySelectionState(parent, values, items, selections, original, replacements = 0) {
  const count = abilitySelectionCount(parent, abilityOwnerLevel(parent.data, values))
  const selected = rows(selections)
  const selectedIds = new Set(selected.map(entry => id(entry.id)))
  const removed = rows(original).filter(entry => !selectedIds.has(id(entry.id))).length
  const map = new Map(items.map(item => [id(item.id), item]))
  const errors = []
  if (selected.length !== count) errors.push(`Выбрано ${selected.length} из ${count}`)
  if (selectedIds.size !== selected.length) errors.push('Одинаковые способности нельзя выбирать дважды')
  if (removed > replacements) errors.push(`Можно заменить не более ${replacements}`)
  for (const entry of selected) {
    const item = map.get(id(entry.id))
    if (!item) { errors.push('Не удалось загрузить выбранную способность'); continue }
    errors.push(...selectedAbilityEligibility(item, parent, values).reasons.map(reason => `${item.name}: ${reason}`))
    if (!choiceSelectionsComplete(item, entry.choices || {})) errors.push(`${item.name}: завершите выбор`)
  }
  return { count, removed, ready: !errors.length, errors }
}

/** Replace only this selection's entries. Retained entries keep their charge state and UID. */
export function applyAbilitySelection(values, parent, selections, items) {
  const previous = selectedAbilityEntries(values, parent, items)
  const selectedIds = new Set(previous.map(entry => id(entry.id)))
  const map = new Map(items.map(item => [id(item.id), item]))
  const retained = rows(values.abilities_class).filter(entry => !selectedIds.has(id(entry.id)))
  const chosen = selections.map(entry => {
    const existing = previous.find(old => id(old.id) === id(entry.id))
    if (existing) return { ...existing, selection_source: parent.id, choices: entry.choices || existing.choices || {} }
    return { id: entry.id, uid: makeUid('ability'), selection_source: parent.id,
      ...(entry.choices ? { choices: entry.choices } : {}),
      ...(abilityHasResources(map.get(id(entry.id))?.data) ? { resource_version: 1 } : {}),
    }
  })
  const keptIds = new Set(chosen.map(entry => id(entry.id)))
  const removedIds = new Set(previous.filter(entry => !keptIds.has(id(entry.id))).map(entry => id(entry.id)))
  return { ...values, abilities_class: [...retained, ...chosen],
    ...(removedIds.size ? { states: rows(values.states).filter(state => !(
      ['ability', 'feature_action'].includes(state.source?.kind) && removedIds.has(id(state.source?.item_id))
    )) } : {}),
  }
}
