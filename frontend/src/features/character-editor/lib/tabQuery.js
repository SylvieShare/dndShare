export function defaultTabIndex(tabs) {
  const index = Array.isArray(tabs) ? tabs.findIndex(tab => tab?.default) : -1
  return index >= 0 ? index : 0
}

export function parseTabQuery(value, tabs, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value
  const index = tabs.findIndex(tab => tab.id === raw)
  return index >= 0 ? index : fallback
}

export function queryForTab(currentQuery, index, defaultIndex, tabs) {
  const query = { ...(currentQuery || {}) }
  if (index === defaultIndex) delete query.tab
  else query.tab = tabs[index].id
  return query
}
