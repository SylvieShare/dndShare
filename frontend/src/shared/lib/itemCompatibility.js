export const COMPATIBILITY_STATUSES = [
  { value: 'native', label: 'Исходная редакция' },
  { value: 'compatible', label: 'Совместимо' },
  { value: 'legacy', label: 'Прежняя версия' },
  { value: 'requires_adaptation', label: 'Нужна адаптация' },
  { value: 'blocked', label: 'Недоступно' },
]

export function itemCompatibility(item, sourceVersionId) {
  return item?.compatibility?.find(row => Number(row.sourceVersionId) === Number(sourceVersionId)) || null
}

export function itemEditionEligibility(item, sourceVersionId) {
  if (sourceVersionId == null) return { eligible: true, reasons: [] }
  const row = itemCompatibility(item, sourceVersionId)
  if (row && ['native', 'compatible'].includes(row.status)) return { eligible: true, reasons: [] }
  const labels = {
    legacy: 'Для этой редакции используется другой вариант',
    requires_adaptation: 'Этот вариант требует адаптации',
    blocked: 'Недоступно в выбранной редакции',
  }
  return { eligible: false, reasons: [row?.note || labels[row?.status] || 'Совместимость с редакцией не проверена'] }
}
