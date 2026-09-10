// Filters use leaf paths (including array members, such as classes.id).
export function choiceFilterFields(fields, prefix = '', parentName = '') {
  return (fields || []).flatMap(field => {
    const path = prefix ? `${prefix}.${field.key}` : field.key
    const name = parentName ? `${parentName} · ${field.name}` : field.name
    if (['object', 'object_array'].includes(field.type)) return choiceFilterFields(field.fields, path, field.name)
    return ['int', 'float', 'select', 'suggest', 'suggest_array', 'bool', 'boolean', 'item', 'text'].includes(field.type)
      ? [{ ...field, path, name }] : []
  })
}
