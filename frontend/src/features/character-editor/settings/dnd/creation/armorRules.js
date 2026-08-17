const ARMOR_BY_NAME = new Map([
  ['стёганый доспех', { ac: 11, use_dex: true }],
  ['стеганый доспех', { ac: 11, use_dex: true }],
  ['кожаный доспех', { ac: 11, use_dex: true }],
  ['кожаная броня', { ac: 11, use_dex: true }],
  ['проклёпанная кожа', { ac: 12, use_dex: true }],
  ['проклепанная кожа', { ac: 12, use_dex: true }],
  ['шкурный доспех', { ac: 12, use_dex: true, dex_cap: 2 }],
  ['кольчужная рубаха', { ac: 13, use_dex: true, dex_cap: 2 }],
  ['чешуйчатый доспех', { ac: 14, use_dex: true, dex_cap: 2 }],
  ['кираса', { ac: 14, use_dex: true, dex_cap: 2 }],
  ['полулаты', { ac: 15, use_dex: true, dex_cap: 2 }],
  ['колечный доспех', { ac: 14, use_dex: false }],
  ['кольчуга', { ac: 16, use_dex: false }],
  ['наборный доспех', { ac: 17, use_dex: false }],
  ['латы', { ac: 18, use_dex: false }],
  ['щит', { shield: true, shield_bonus: 2 }],
  ['деревянный щит', { shield: true, shield_bonus: 2 }],
])

function normalizeName(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU')
}

export function armorRuleByName(name) {
  const rule = ARMOR_BY_NAME.get(normalizeName(name))
  return rule ? { ...rule } : null
}

export function armorRuleForEquipment(entry) {
  const stored = entry?.armor || entry?.data?.armor
  if (stored && typeof stored === 'object') return { ...stored }
  return armorRuleByName(entry?.name)
}

export function isArmorEquipment(entry) {
  return armorRuleForEquipment(entry) != null
}
