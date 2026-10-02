export function presetId(value) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export function selectableIconPresets(presets, typeIds) {
  const ids = new Set(typeIds.map(Number))
  return presets.filter(preset => preset.purpose === 'item' && ids.has(preset.itemTypeId))
}

export function customInventoryIcon(entry, presetsById) {
  if (entry?.item_id != null) return ''
  const preset = presetsById[presetId(entry?.icon_preset_id)]
  return preset?.purpose === 'item' ? preset.imageUrl || '' : ''
}
