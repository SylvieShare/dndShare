import { itemsApi } from '@/shared/api/itemsApi'
import { baseTypeId, eligibleMagicBase } from './magicEquipmentBases'

/** Load and validate candidates before deciding whether the user has a choice. */
export async function loadMagicBases(item, kind, knownBases = []) {
  const rule = item.data?.[kind] || {}
  const ids = rule.base_item_id ? [rule.base_item_id] : rule.allowed_base_item_ids
  const known = ids?.map(id => knownBases.find(base => Number(base.id) === Number(id)))
  const response = known?.length && known.every(Boolean) ? { items: known }
    : !ids?.length && knownBases.length ? { items: knownBases }
    : ids?.length ? await itemsApi.byIds(ids) : await itemsApi.listAll(baseTypeId(kind))
  return (response.items || []).filter(base => eligibleMagicBase(item, base, kind))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}
