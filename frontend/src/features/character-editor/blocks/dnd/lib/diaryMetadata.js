export function diarySourceLabel(event) {
  if (!event.sourceSceneItemId && !event.sourceSnapshot) return ''
  const snapshot = event.sourceSnapshot || {}
  return ['Из сценария', snapshot.scene?.name, snapshot.block?.title].filter(Boolean).join(' · ')
}

export function diaryAuditRows(event) {
  if (!event.createdAt) return []
  const rows = [{ label: 'Создано', at: event.createdAt, author: event.authorName || 'Автор не сохранён' }]
  if (event.changedAt && (event.changedAt !== event.createdAt ||
    (event.changedByUserId != null && event.changedByUserId !== event.authorUserId))) {
    rows.push({ label: 'Изменено', at: event.changedAt, author: event.changedByName || 'Автор правки не сохранён' })
  }
  return rows
}

export function formatDiaryTimestamp(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Время неизвестно' : date.toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}
