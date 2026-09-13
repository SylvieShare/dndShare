export function sessionEventEntity(event) {
  const data = event.data || {}
  const source = data.source
  const itemId = source?.itemId || data.itemId || data.spellId
  if (itemId) return { key: `item:${itemId}`, itemId, name: source?.name || '', instanceUid: source?.instanceUid }
  if (data.ability) return { key: `ability:${data.ability.id || data.ability.name}`, name: data.ability.name, ability: data.ability }
  if (event.type === 'spell_slot_changed') return { key: `spell:${data.slotPool}:${data.slotLevel}`, name: `Ячейки заклинаний · ${data.slotLevel} круг`, slot: true }
  if (data.resourceKey) return { key: `resource:${data.resourceKey}`, name: data.resourceChanges?.[0]?.name || 'Ресурс', resource: true }
  return null
}

export function sessionEventAction(event, name) {
  const action = String(event.action || '')
  if (!name) return action
  if (action.endsWith(`: ${name}`)) return action.slice(0, -(name.length + 2))
  if (action.startsWith(`${name}: `)) return action.slice(name.length + 2)
  if (action.startsWith(`${name} — `)) return action.slice(name.length + 3)
  const itemSuffix = `: ${name} — `
  if (action.includes(itemSuffix)) return action.replace(itemSuffix, ' — ')
  if (action === name) return event.type === 'dice_roll' ? 'Бросок' : 'Использование'
  return action
}

export function sessionEventDetails(event) {
  const data = event.data || {}
  if (event.type === 'spell_used' && !data.resourceChanges?.length) {
    return data.slotPool === 'slotless' ? 'Без расхода ячейки' : Number(data.spellLevel) === 0 ? 'Заговор · без ячейки' : ''
  }
  if (['item_spent', 'item_added'].includes(event.type)) return `Осталось: ${data.remaining ?? '—'}`
  if (event.type === 'entry_added' && Number(data.count) > 1) return `Количество: ${data.count}`
  if (event.type === 'resource_used') return `Осталось: ${data.remaining ?? '—'} / ${data.total ?? '—'}`
  return ''
}
