// UX metadata lives beside the editors; handbook schemas remain the storage contract.
// Each gate owns its fields: switching it off removes their saved values.
export const abilityMechanicManifest = {
  sheet_widgets: {
    main: ['title', 'kind', 'value_source', 'value', 'status_effect_key', 'description', 'details', 'tone'],
    gates: [
      { title: 'Свои подписи переключателя', keys: ['inactive_label', 'active_label'], when: data => data.kind === 'toggle' },
      { title: 'Выбрать отдельный ресурс', keys: ['resource_key'], when: data => data.kind !== 'note' },
      { title: 'Изменить порядок на листе', keys: ['priority'] },
    ],
    visible: (key, data) => {
      if (key === 'status_effect_key') return data.kind === 'toggle'
      if (['value', 'value_source'].includes(key) && data.kind === 'note') return false
      if (key === 'value') return !data.value_source
      return true
    },
    fields: {
      kind: { name: 'Что показать', options: [{ value: 'metric', label: 'Показатель' }, { value: 'toggle', label: 'Переключатель эффекта' }, { value: 'note', label: 'Дополнение другой панели' }] },
      value_source: { name: 'Откуда брать значение', emptyLabel: 'Постоянное значение', hint: 'Урон и значение прогрессии пересчитываются автоматически при изменении уровня.' },
      status_effect_key: { name: 'Какой эффект включать', hint: 'Выберите связанный эффект этой способности по названию.' },
      resource_key: { name: 'Ресурс на панели', hint: 'Без отдельного выбора панель показывает основной ресурс этой способности.' },
    },
  },
  usage: {
    main: ['text'],
    gates: [
      { title: 'Запретить с некоторой бронёй', keys: ['not_armor'] },
      { title: 'Требовать определённую броню', keys: ['requires_armor'] },
    ],
    fields: { text: { name: 'Условие использования', hint: 'Краткая памятка игроку. Ограничения по броне настраиваются отдельно ниже.' } },
  },
}

export function mechanicFields(kind, fields, keys, data) {
  const manifest = abilityMechanicManifest[kind]
  return keys.map(key => fields.find(field => field.key === key)).filter(Boolean)
    .filter(field => !manifest.visible || manifest.visible(field.key, data))
    .map(field => ({ ...field, ...manifest.fields?.[field.key] }))
}

export function updateMechanic(kind, data, next) {
  if (kind === 'sheet_widgets') {
    if (next.kind !== data.kind) {
      if (next.kind !== 'toggle') for (const key of ['status_effect_key', 'inactive_label', 'active_label']) delete next[key]
      if (next.kind === 'note') for (const key of ['value', 'value_source', 'resource_key']) delete next[key]
    }
    if (next.value_source) delete next.value
  }
  for (const key of Object.keys(data)) if (!(key in next)) delete data[key]
  Object.assign(data, next)
}
