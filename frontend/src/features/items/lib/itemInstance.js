function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export function applicableInstanceFields(type, item) {
  return (type?.instanceFields || []).filter((field) => {
    const condition = field?.applies_when
    if (!condition) return true
    return item?.data?.[condition.item_data_key] === condition.value
  })
}

export function normalizeInstanceParams(params, fields = [], { defaults = false } = {}) {
  const source = plainObject(params)
  const next = {}
  for (const field of fields) {
    let value = source[field.key]
    if (value == null && defaults) value = field.default
    if (value == null || value === '') continue
    if (field.type === 'int') {
      value = Number(value)
      if (!Number.isFinite(value)) continue
      value = Math.trunc(value)
      if (field.min != null) value = Math.max(Number(field.min), value)
      if (field.max != null) value = Math.min(Number(field.max), value)
    } else if (field.type === 'boolean' || field.type === 'bool') {
      value = !!value
    }
    next[field.key] = value
  }
  return next
}

export function defaultInstanceParams(type, item) {
  const fields = applicableInstanceFields(type, item)
  return normalizeInstanceParams({}, fields, { defaults: true })
}

export function copperCost(value) {
  const copper = Math.round(Number(value))
  if (!Number.isFinite(copper) || copper < 0) return null
  if (copper % 100 === 0) return { value: copper / 100, suggest_id: 3 }
  if (copper % 10 === 0) return { value: copper / 10, suggest_id: 2 }
  return { value: copper, suggest_id: 1 }
}

export function measuredItemEconomy(type, item, params = null) {
  const fields = applicableInstanceFields(type, item)
  const field = fields.find(entry => entry.unit_cost_data_key || entry.unit_weight_data_key)
  if (!field) return null

  const values = params == null
    ? normalizeInstanceParams({}, fields, { defaults: true })
    : normalizeInstanceParams(params, fields)
  const quantity = Number(values[field.key])
  if (!Number.isFinite(quantity) || quantity <= 0) return null

  const unitCost = Number(item?.data?.[field.unit_cost_data_key])
  const unitWeight = Number(item?.data?.[field.unit_weight_data_key])
  const costCopper = Number.isFinite(unitCost) && unitCost >= 0 ? Math.round(quantity * unitCost) : null
  const weight = Number.isFinite(unitWeight) && unitWeight >= 0 ? quantity * unitWeight : null

  return {
    quantity,
    unit: field.unit || '',
    costCopper,
    cost: costCopper == null ? null : copperCost(costCopper),
    weight,
  }
}

export function instanceParamsKey(params) {
  const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
  }
  return JSON.stringify(canonical(plainObject(params)))
}

export function instanceParamLabels(params, fields = []) {
  const source = plainObject(params)
  return fields.flatMap((field) => {
    const value = source[field.key]
    if (value == null || value === '') return []
    if (field.key === 'magic_bonus') return Number(value) > 0 ? [`+${Number(value)}`] : []
    const option = (field.options || []).find((entry) => String(entry.value) === String(value))
    return [`${option?.label || value}${field.unit ? ` ${field.unit}` : ''}`]
  })
}

export function instanceDisplayName(item, params, type) {
  const labels = instanceParamLabels(params, applicableInstanceFields(type, item))
  return [item?.name || '—', ...labels].join(' · ')
}
