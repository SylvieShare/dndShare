import { unref } from 'vue'
import { inventoryEntries } from './characterMagicItems'

export function itemEventData(item, instanceUid) {
  if (!item?.id) return {}
  return { source: { itemId: item.id, name: item.name, ...(instanceUid ? { instanceUid } : {}) } }
}

export function instanceEventData(charCtx, uid) {
  const entry = inventoryEntries(unref(charCtx.values) || {}).find(row => row.entry.uid === uid)?.entry
  const id = entry?.magic_item_id || entry?.item_id
  const item = unref(charCtx.characterResources?.itemsById)?.get(String(id))
  return itemEventData(item || (id ? { id } : null), uid)
}

export function resourceChangeData(resource, next, item = null) {
  next = Math.max(0, Math.min(Number(resource.total) || 0, Number(next) || 0))
  return {
    ...itemEventData(item || (resource.item_id ? { id: resource.item_id } : null)),
    resourceKey: resource.key,
    remaining: next,
    total: resource.total,
    resourceChanges: [{
      key: resource.key, name: resource.title, color: resource.color_point,
      delta: next - Number(resource.value), remaining: next, total: resource.total,
    }],
  }
}

export function logResourceChange(charCtx, resource, next, item = null) {
  if (!resource) return
  next = Math.max(0, Math.min(Number(resource.total) || 0, Number(next) || 0))
  if (next === Number(resource.value)) return
  item ||= unref(charCtx.characterResources?.itemsById)?.get(String(resource.item_id))
  charCtx.logSessionEvent?.({
    type: 'resource_used',
    action: next < Number(resource.value) ? 'Использование ячеек' : 'Восстановление ячеек',
    data: resourceChangeData(resource, next, item),
  })
}

export function spellSlotChanges(before, after) {
  return ['long_rest', 'short_rest'].flatMap(pool => (after?.slot_pools?.[pool] || []).flatMap(slot => {
    const previous = before?.slot_pools?.[pool]?.find(row => Number(row.level) === Number(slot.level))
    const delta = Number(previous?.used || 0) - Number(slot.used || 0)
    return delta ? [{ key: `spell:${pool}:${slot.level}`, name: `Ячейка ${slot.level} круга`, level: Number(slot.level), pool,
      delta, remaining: slot.total - slot.used, total: slot.total }] : []
  }))
}

export function logSpellSlotRecovery(charCtx, before, after) {
  const changes = spellSlotChanges(before, after)
  for (const change of changes) charCtx.logSessionEvent?.({ type: 'spell_slot_changed', action: 'Восстановление ячеек после отдыха',
    data: { slotLevel: change.level, slotPool: change.pool, resourceChanges: [change] } })
}
