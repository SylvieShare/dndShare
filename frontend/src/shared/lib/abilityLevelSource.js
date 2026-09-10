const ids = rows => (rows || []).map(row => String(row?.id ?? row))
const levelOf = value => Math.max(0, Math.floor(Number(value) || 0))

export function abilityLevelContext(data = {}, values = {}) {
  const mode = data.level_source || 'bound'
  const sheetLevel = levelOf(values?.lvl?.level)
  if (mode === 'character') return { level: sheetLevel, missingClass: false }
  const classIds = mode === 'class' ? [String(data.level_class_id?.id ?? data.level_class_id ?? '')] : ids(data.class_ids)
  const subclassIds = mode === 'class' ? classIds : ids(data.subclass_ids)
  if (mode === 'bound' && !classIds.length && !subclassIds.length) return { level: sheetLevel, missingClass: false }
  const classes = Array.isArray(values?.classes) ? values.classes : []
  const matches = classes.filter(row => classIds.includes(String(row.id)) || subclassIds.includes(String(row.subclass?.id)))
  if (!matches.length) return { level: 0, missingClass: true }
  // A single-class sheet owns its level; multiclass entries own their individual levels.
  return { level: classes.length === 1 && sheetLevel > 0 ? sheetLevel : Math.max(...matches.map(row => levelOf(row.level))), missingClass: false }
}

export function abilityLevelSourceLabel(data = {}, name = id => `#${id}`) {
  const mode = data.level_source || 'bound'
  if (mode === 'character') return 'Общий уровень персонажа'
  if (mode === 'class') {
    const id = data.level_class_id?.id ?? data.level_class_id
    return id ? `Класс: ${name(id)}` : 'Класс не выбран'
  }
  const bindings = [...ids(data.class_ids), ...ids(data.subclass_ids)]
  if (!bindings.length) return 'Общий уровень персонажа — нет привязки к классу'
  return `${bindings.length === 1 ? 'Класс' : 'Наибольший уровень из классов'}: ${bindings.map(name).join(', ')}`
}
