import { catalogueField, catalogueFieldVisible } from './catalogueFields'

export function catalogueValidation(fields, data, typeId) {
  const errors = []
  function walk(schema, values, prefix = '') {
    for (const raw of schema || []) {
      const path = prefix ? `${prefix}.${raw.key}` : raw.key
      if (raw.readonly || !catalogueFieldVisible(raw, values, typeId, path, data)) continue
      const field = catalogueField(raw, typeId, path), value = values[raw.key]
      if (field.required && (value == null || value === '' || Array.isArray(value) && !value.length)) errors.push(`Заполните «${field.name}».`)
      if (value == null || value === '') continue
      if (['int', 'float'].includes(field.type)) {
        const n = Number(value)
        if (!Number.isFinite(n) || field.type === 'int' && !Number.isInteger(n)) errors.push(`«${field.name}»: введите ${field.type === 'int' ? 'целое ' : ''}число.`)
        else if (field.min != null && n < field.min || field.max != null && n > field.max) errors.push(`«${field.name}»: допустимо ${field.min ?? '…'}–${field.max ?? '∞'}.`)
      }
      if (field.type === 'int_by_suggest' && value.value != null && (Number(value.value) < 0 || !value.suggest_id)) errors.push(`«${field.name}»: укажите неотрицательную сумму и валюту.`)
      if (field.type === 'object' && typeof value === 'object') walk(field.fields, value, path)
      if (field.type === 'object_array' && Array.isArray(value)) {
        for (const row of value) walk(field.fields, row, path)
        if (['class_resources', 'item_choices', 'variants'].includes(path)) {
          const key = path === 'variants' ? 'value' : 'key'
          if (value.some(row => !row[key]) || new Set(value.map(row => row[key])).size !== value.length) errors.push(`«${field.name}»: у каждой записи должен быть свой непустой ключ.`)
        }
        if (path === 'item_choices' && value.some(row => !row.option_item_ids?.length)) errors.push('Выбор снаряжения: добавьте доступные предметы.')
        if (['class_resources.scaling', 'spellcasting.known_progression', 'spellcasting.unrestricted_progression'].includes(path) && (value.some(row => !(Number(row.level) >= 1 && Number(row.level) <= 20)) || new Set(value.map(row => Number(row.level))).size !== value.length)) errors.push(`«${field.name}»: укажите разные уровни от 1 до 20.`)
        if (/^(attacks|universe_attacks|(damage|heal)\.(dices|addon))$/.test(path) && value.some(row => !row.dice_id)) errors.push(`«${field.name}»: выберите кость для каждой строки.`)
      }
    }
  }
  walk(fields, data)
  if (typeId === 1 && data.range_max != null && data.range_min != null && Number(data.range_max) < Number(data.range_min)) errors.push('Предельная дистанция не может быть меньше обычной.')
  if (typeId === 15 && ['rounds', 'minutes', 'hours'].includes(data.duration?.kind) && !(Number(data.duration.value) > 0)) errors.push('Укажите длительность эффекта больше нуля.')
  return [...new Set(errors)]
}
