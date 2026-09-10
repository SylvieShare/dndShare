/** The same eligibility contract powers catalogue previews and instance creation. */
export function magicEquipmentKinds(item) {
  return Number(item?.typeId) === 19 ? ['weapon', 'armor_base'].filter(key => item.data?.[key]) : []
}
export const baseTypeId = kind => kind === 'weapon' ? 1 : 12
export const baseParamKey = kind => kind === 'weapon' ? 'weapon_base_item_id' : 'armor_base_item_id'
export function magicBaseId(item, params, kind) {
  const rule = item?.data?.[kind]
  if (!magicEquipmentKinds(item).includes(kind)) return null
  const id = Number(rule.base_item_id || params?.[baseParamKey(kind)])
  return id > 0 && (!rule.allowed_base_item_ids?.length || rule.base_item_id || rule.allowed_base_item_ids.map(Number).includes(id)) ? id : null
}
export function eligibleMagicBase(item, base, kind) {
  if (Number(base?.typeId) !== baseTypeId(kind) || Number(base.id) === 64) return false
  if (kind === 'armor_base' && !base.data?.armor) return false
  const rule = item?.data?.[kind]
  return !!rule && (rule.base_item_id ? Number(rule.base_item_id) === Number(base.id) : !rule.allowed_base_item_ids?.length || rule.allowed_base_item_ids.map(Number).includes(Number(base.id)))
}
export function magicBaseParams(item, params = {}) {
  return Object.fromEntries(magicEquipmentKinds(item).map(kind => [baseParamKey(kind), magicBaseId(item, params, kind)]).filter(([, id]) => id))
}
