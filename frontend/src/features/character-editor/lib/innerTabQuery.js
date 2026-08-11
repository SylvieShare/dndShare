const QUERY_PREFIX = 'innerTab-'

function blockIdentity(block) {
  if (!block) return null
  return {
    type: block.type || null,
    id: block.id || null,
    tabs: (block.tabs || []).map(tab => ({
      title: tab.title || null,
      block: blockIdentity(tab.block),
    })),
    blocks: (block.blocks || []).map(blockIdentity),
  }
}

function hashIdentity(value) {
  const text = JSON.stringify(value)
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}

export function innerTabQueryKey(block) {
  // An explicit key disambiguates intentionally identical tab groups. Otherwise
  // the schema structure gives each distinct group a stable key across reloads.
  const explicitKey = block?.props?.queryKey ?? block?.content?.queryKey
  const identity = explicitKey == null
    ? blockIdentity(block)
    : { queryKey: String(explicitKey) }
  return `${QUERY_PREFIX}${hashIdentity(identity)}`
}

export function parseInnerTabQuery(value, tabCount, fallback = 0) {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !/^\d+$/.test(raw)) return fallback
  const index = Number(raw)
  return Number.isSafeInteger(index) && index >= 0 && index < tabCount ? index : fallback
}

export function queryForInnerTab(currentQuery, key, index, defaultIndex = 0) {
  const query = { ...(currentQuery || {}) }
  if (index === defaultIndex) delete query[key]
  else query[key] = String(index)
  return query
}
