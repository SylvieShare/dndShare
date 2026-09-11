import { hpMaximum, normalizeHpMaximum } from './hp'

export function hpHistoryRows(hp) {
  const maximum = normalizeHpMaximum(hp?.max)
  const history = Array.isArray(hp?.history) ? hp.history : []
  const rows = history.map((entry) => ({
    label: entry.kind === 'level'
      ? `${entry.className || 'Класс'}${entry.classLevel ? ` · ${entry.classLevel} ур.` : ''}`
      : entry.kind === 'manual' ? 'Ручная корректировка' : 'База без истории',
    note: entry.kind === 'level' ? `Уровень персонажа ${entry.level}` : '',
    value: Math.trunc(Number(entry.gain) || 0),
  }))
  const remainder = maximum.base - rows.reduce((sum, row) => sum + row.value, 0)
  if (remainder || !rows.length) rows.push({ label: 'База без истории', note: '', value: remainder })
  for (const bonus of maximum.bonuses) rows.push({
    label: bonus.name || bonus.title || 'Бонус',
    note: bonus.source_label || (bonus.source?.sourceId ? 'Способность' : 'Ручной бонус'),
    value: Math.trunc(Number(bonus.value) || 0),
  })
  const sum = rows.reduce((total, row) => total + row.value, 0)
  if (sum < 0) rows.push({ label: 'Минимум хитов — 0', note: '', value: -sum })
  return { rows, total: hpMaximum(hp), incomplete: rows.some((row) => row.label === 'База без истории') }
}
