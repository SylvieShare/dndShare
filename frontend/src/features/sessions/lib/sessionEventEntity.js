export function sessionEventEntity(event) {
  const data = event.data || {}
  const source = data.source
  const itemId = source?.itemId || data.itemId || data.spellId
  if (itemId) return { key: `item:${itemId}`, itemId, name: source?.name || '', instanceUid: source?.instanceUid }
  if (data.ability) return { key: `ability:${data.ability.id || data.ability.name}`, name: data.ability.name, ability: data.ability }
  if (event.type === 'spell_slot_changed') return { key: 'spell-slots', name: 'Ячейки заклинаний', slot: true }
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
  if (event.type === 'item_transfer') {
    const status = { pending: 'Ожидает', accepted: 'Приняли', rejected: 'Отказали' }[data.status] || 'Ожидает'
    const count = Number(data.count) > 1 ? ` · ×${data.count}` : ''
    return `${data.senderName} → ${data.recipientName}${count} · ${status}`
  }
  if (event.type === 'spell_used' && !data.resourceChanges?.length) {
    return data.slotPool === 'slotless' ? 'Без расхода ячейки' : Number(data.spellLevel) === 0 ? 'Заговор · без ячейки' : ''
  }
  if (event.type === 'entry_added' && Number(data.count) > 1) return `Количество: ${data.count}`
  return ''
}

export function sessionEventTransition(event) {
  const data = event.data || {}
  const changes = (data.resourceChanges || []).filter(change => Number.isFinite(change.remaining) && Number.isFinite(change.delta))
  if (changes.length) return changes.map(change => {
    const label = changes.length > 1 ? `${change.name}: ` : ''
    return `${label}${change.remaining - change.delta} → ${change.remaining}`
  }).join(', ')
  if (['item_spent', 'item_added'].includes(event.type) && Number.isFinite(data.remaining)) {
    const delta = event.type === 'item_spent' ? -1 : 1
    return `${data.remaining - delta} → ${data.remaining}`
  }
  return ''
}
