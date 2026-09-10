const transliteration = { а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'kh',ц:'ts',ч:'ch',ш:'sh',щ:'shch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya' }
export function normalizedRuleKey(title) {
  return [...String(title || '').toLowerCase()].map(char => transliteration[char] ?? char).join('')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}
export function uniqueRuleKey(title, usedKeys = []) {
  const base = normalizedRuleKey(title)
  if (!base) return ''
  const used = new Set(usedKeys.filter(Boolean))
  let key = base, index = 2
  while (used.has(key)) key = `${base}_${index++}`
  return key
}
export function actionResourceMode(data) {
  if (data.resource_pool_key) return 'pool'
  if (data.resource_key || Number(data.resource_item_id) > 0) return 'selected'
  return data.uses_resource ? 'self' : 'none'
}
export function changeActionResource(data, mode, reference) {
  for (const key of ['resource_pool_key', 'resource_key', 'resource_item_id', 'resource_cost']) delete data[key]
  data.uses_resource = mode !== 'none'
  if (mode === 'none') return
  data.resource_cost = 1
  if (mode === 'pool') data.resource_pool_key = reference?.key || ''
  if (mode === 'selected') {
    data.resource_key = reference?.key || ''
    if (reference?.itemId) data.resource_item_id = reference.itemId
  }
}
export function localRuleReferences(data, itemId, itemName) {
  const references = []
  const add = (kind, block, row, key = row.key || '') => references.push({ kind, block, key, title: row.title || row.label || row.text || itemName || 'Текущая способность', itemId: itemId || 0, itemName: itemName || 'Текущая способность' })
  if (data.max_use != null || data.max_use_stat != null || data.max_use_level_multiplier != null || data.max_use_scaling || data.manual_size) add('resource', 'Ресурс способности', data, '')
  for (const [field, kind, block] of [['use_resources','resource','Отдельный ресурс'],['class_resources','resource_pool','Ресурс класса'],['feature_actions','action','Действие на листе'],['choices','choice','Выбор'],['status_effects','effect_link','Связанный эффект'],['sheet_widgets','widget','Виджет листа'],['weapon_damage','weapon_damage','Дополнительный урон оружия']]) {
    for (const row of data[field] || []) if (row.key) add(kind, block, row)
  }
  return references
}

export function actionEditorError(data, mode, ownerData, otherKeys = []) {
  const title = String(data.title || '').trim()
  const prefix = title ? `«${title}»` : 'Новое действие'
  if (!title) return `${prefix}: укажите название.`
  if (data.key && otherKeys.includes(data.key)) return `${prefix}: ключ уже используется другим действием.`
  if (mode === 'pool' && !data.resource_pool_key) return `${prefix}: выберите общий ресурс.`
  if (mode === 'selected' && !data.resource_key && !(Number(data.resource_item_id) > 0)) return `${prefix}: выберите ресурс способности.`
  if (mode === 'self' && !localRuleReferences(ownerData, 0, '').some(ref => ref.kind === 'resource' && !ref.key)) return `${prefix}: добавьте основной ресурс этой способности или выберите другой источник расхода.`
  if (mode !== 'none' && (!Number.isFinite(Number(data.resource_cost)) || Number(data.resource_cost) < 0)) return `${prefix}: расход должен быть неотрицательным числом.`
  if (data.target_kind === 'weapon' && !data.status_effect_code) return `${prefix}: выберите эффект для оружия.`
  const seen = new Set()
  for (const row of data.menu_effects || []) {
    if (!row.title?.trim() || row.kind !== 'adjust_counter' || !row.value_id || !row.counter_key) return `${prefix}: у каждого пункта меню должны быть название и изменяемый показатель.`
    if (row.key && seen.has(row.key)) return `${prefix}: ключи пунктов меню должны различаться.`
    if (row.key) seen.add(row.key)
    if (row.min != null && row.max != null && row.max !== '' && Number(row.min) > Number(row.max)) return `${prefix}: нижняя граница показателя больше верхней.`
  }
  return ''
}

export function normalizeActionResource(data, mode = actionResourceMode(data)) {
  const cost = data.resource_cost
  const reference = { key: mode === 'pool' ? data.resource_pool_key : data.resource_key, itemId: data.resource_item_id }
  changeActionResource(data, mode, reference)
  if (mode !== 'none') data.resource_cost = cost ?? 0
  return mode
}

export function renameWeaponDamageKey(owner, rule, key) {
  const previous = rule.key
  const ambiguous = (owner.weapon_damage || []).some(other => other !== rule && other.key === previous)
  rule.key = key
  const conflict = (owner.weapon_damage || []).some(other => other !== rule && other.key === key)
  if (!previous || !key || previous === key || conflict || ambiguous) return
  for (const widget of owner.sheet_widgets || []) {
    if (widget.value_source === 'weapon_damage' && widget.weapon_damage_key === previous) widget.weapon_damage_key = key
  }
}
