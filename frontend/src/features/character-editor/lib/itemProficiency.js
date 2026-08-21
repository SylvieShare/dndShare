const RULES = {
  1: {
    bucket: 'Оружие',
    suggestTypeId: 4,
    dataKey: 'required_weapon_proficiencies',
    many: true,
  },
  12: {
    bucket: 'Доспехи',
    suggestTypeId: 3,
    dataKey: 'required_armor_proficiency',
    many: false,
  },
  14: {
    bucket: 'Инструменты',
    suggestTypeId: 5,
    dataKey: 'required_tool_proficiencies',
    many: true,
  },
}

function proficiencyName(value) {
  if (value && typeof value === 'object') return String(value.name ?? value.value ?? value.title ?? '')
  return String(value ?? '')
}

function normalized(value) {
  return proficiencyName(value).trim().toLocaleLowerCase('ru')
}

export function itemProficiencyRule(item) {
  return RULES[Number(item?.typeId)] || null
}

export function hasItemProficiency(item, values, suggestItems) {
  const rule = itemProficiencyRule(item)
  if (!rule) return false
  const raw = item?.data?.[rule.dataKey]
  const requiredIds = rule.many ? (Array.isArray(raw) ? raw : []) : (raw == null ? [] : [raw])
  if (!requiredIds.length) return false

  const owned = new Set((Array.isArray(values?.proficiencies?.[rule.bucket])
    ? values.proficiencies[rule.bucket]
    : [])
    .map(normalized)
    .filter(Boolean))
  if (!owned.size) return false

  const required = new Set(requiredIds.map(String))
  return (suggestItems(rule.suggestTypeId) || []).some((suggest) => (
    required.has(String(suggest.id)) && owned.has(normalized(suggest.value))
  ))
}
