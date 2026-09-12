export const AUTOMATION_STATUSES = [
  { value: 'unreviewed', label: 'Не оценено', hint: 'Поддержка механик этой записи ещё не проверена.', tone: 'muted' },
  { value: 'full', label: 'Полностью', hint: 'Все применимые механики поддержаны сайтом. Выбор игрока и предусмотренное правилами ручное подтверждение могут оставаться.', tone: 'success' },
  { value: 'partial', label: 'Частично', hint: 'Сайт поддерживает часть механик. Остальные нужно учитывать вручную.', tone: 'warning' },
  { value: 'none', label: 'Не автоматизировано', hint: 'Запись содержит правила, но сайт пока не применяет их механику.', tone: 'muted' },
  { value: 'not_applicable', label: 'Не требуется', hint: 'У записи нет механик, требующих автоматизации.', tone: 'muted' },
]
export const PLAYER_INTERACTION_HINT = 'Применение затрагивает персонажа другого игрока и требует согласования или действий на его листе. Это отдельный признак, а не степень автоматизации.'
export function automationStatus(value) {
  return AUTOMATION_STATUSES.find(row => row.value === value) || AUTOMATION_STATUSES[0]
}
export function itemAutomationDraft(item) {
  return {
    automationStatus: automationStatus(item?.automationStatus).value,
    automationNote: item?.automationNote || '',
    requiresPlayerInteraction: !!item?.requiresPlayerInteraction,
  }
}
