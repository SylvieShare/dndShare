export function defaultTabIndex(tabs) {
  const index = Array.isArray(tabs) ? tabs.findIndex(tab => tab?.default) : -1
  return index >= 0 ? index : 0
}

export function parseTabQuery(value, tabCount, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value
  const text = typeof raw === 'number' ? String(raw) : raw
  if (typeof text !== 'string' || !/^\d+$/.test(text)) return fallback
  const index = Number(text)
  return Number.isSafeInteger(index) && index >= 0 && index < tabCount ? index : fallback
}

export function queryForTab(currentQuery, index, defaultIndex) {
  const query = { ...(currentQuery || {}) }
  if (index === defaultIndex) delete query.tab
  else query.tab = String(index)
  return query
}
