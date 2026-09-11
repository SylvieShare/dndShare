export function itemResourceOptions(item = {}) {
  if (item.use_resources?.length) return item.use_resources.filter(row => row.key).map(row => ({ key: row.key, title: row.title || row.key }))
  return (item.initial_charges || item.max_use != null || item.manual_size || item.max_use_stat != null || item.max_use_scaling || item.max_use_level_multiplier != null) ? [{ key: '', title: 'Заряды предмета' }] : []
}
