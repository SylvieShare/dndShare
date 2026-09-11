import { magicBaseId, magicEquipmentKinds } from './magicEquipmentBases'

/** Catalogue pages keep all options; only an owned instance has selected bases. */
export function selectedMagicBases(item, instance) {
  if (!instance) return []
  return magicEquipmentKinds(item).flatMap(kind => {
    const id = kind === 'weapon' && instance.magic_item_id ? instance.item_id : magicBaseId(item, instance.params, kind)
    return id ? [{ kind, id, item: { ...item, data: { ...item.data, [kind]: { ...item.data[kind], base_item_id: id } } } }] : []
  })
}

export function itemInstancePresentation(item, instance) {
  if (!item || !instance) return item
  return { ...item, name: instance.override?.name ?? item.name, data: { ...item.data, ...instance.override } }
}
