import { allLocalRecords } from './storage'

const snapshots = new Map()
export function invalidateLocalHandbook() { snapshots.clear() }
export async function saveCatalogueMutation(db, scope, item, removedId) {
  const records = await snapshot(scope)
  const id = Number(removedId || item?.id)
  if (!id) return
  const changes = records.filter(entry => entry.key.endsWith(`:item:${id}`)).map(entry => ({ key: entry.key, value: null }))
  if (!removedId && item?.typeId) {
    const type = records.filter(entry => entry.key.endsWith(':metadata')).flatMap(entry => entry.value.types).find(type => type.id === item.typeId)
    if (type) changes.push({ key: `${scope}handbook:${type.sourceId}:item:${id}`, value: item })
  }
  if (changes.length) await db.batch(changes)
  await db.clear(`${scope}http:/api/items`)
  invalidateLocalHandbook()
}
async function snapshot(scope) {
  if (!snapshots.has(scope)) snapshots.set(scope, allLocalRecords(`${scope}handbook:`).catch(error => { snapshots.delete(scope); throw error }))
  return snapshots.get(scope)
}

export async function syncHandbook(db, request, scope, sourceId, signal) {
  const key = `${scope}handbook:${sourceId}:`
  const saved = await db.get(`${key}position`)
  let cursor = saved?.cursor || ''
  let reset = false
  while (!signal.aborted) {
    const response = await request(`/api/handbook/sync?sourceId=${sourceId}&limit=250${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { signal })
    if (response.status === 409 && !reset) { cursor = ''; reset = true; continue }
    if (!response.ok) throw Object.assign(new Error(`Синхронизация справочника: ${response.status}`), { status: response.status })
    const page = await response.json()
    if (page.protocol !== 1 || !Array.isArray(page.entries)) throw Object.assign(new Error('Формат справочника не поддерживается этой версией приложения.'), { code: 'SYNC_PROTOCOL' })
    const changes = page.entries.map(entry => ({ key: `${key}item:${entry.id}`, value: entry.deleted ? null : entry.item }))
    if (page.metadata) changes.push({ key: `${key}metadata`, value: page.metadata })
    cursor = page.hasMore ? page.nextCursor : page.cursor
    if (!cursor) throw new Error('Сервер не вернул курсор справочника')
    if (!page.hasMore && page.visibleIds) {
      const visible = new Set(page.visibleIds.map(String))
      for (const entry of await allLocalRecords(`${key}item:`)) {
        if (!visible.has(entry.key.slice(`${key}item:`.length))) changes.push({ key: entry.key, value: null })
      }
    }
    changes.push({ key: `${key}position`, value: { cursor, complete: !page.hasMore || Boolean(saved?.complete), updatedAt: Date.now() } })
    if (signal.aborted) return
    await db.batch(changes)
    invalidateLocalHandbook()
    if (!page.hasMore) return
  }
}

function nested(value, parts) {
  if (!parts.length) return Array.isArray(value) ? value.flatMap(entry => nested(entry, [])) : [value]
  if (Array.isArray(value)) return value.flatMap(entry => nested(entry, parts))
  return nested(value?.[parts[0]], parts.slice(1))
}

// Match the catalogue's edition, book and field filters against the downloaded records.
export function filterLocalItems(items, params) {
  const version = params.get('sourceVersionId')
  const books = params.has('contentSourceIds') ? params.get('contentSourceIds').split(',').filter(Boolean) : null
  const query = (params.get('q') || '').toLocaleLowerCase('ru')
  const filters = JSON.parse(params.get('filters') || '{}')
  return items.filter(item => {
    if (params.has('typeId') && Number(item.typeId) !== Number(params.get('typeId'))) return false
    if (version) {
      const compatibility = item.compatibility?.find(entry => Number(entry.sourceVersionId) === Number(version))
      if (!compatibility || !['native', 'compatible', ...(params.get('allowLegacy') === 'true' ? ['legacy'] : [])].includes(compatibility.status) || (compatibility.status === 'legacy' && params.get('allowLegacy') !== 'true')) return false
    }
    if (books && item.contentSources?.length && item.userId == null && !item.contentSources.some(source => books.includes(String(source.id ?? source)))) return false
    if (query && !`${item.name} ${item.nameEn || ''}`.toLocaleLowerCase('ru').includes(query)) return false
    for (const [field, selected] of Object.entries(filters)) {
      if (!Array.isArray(selected) || !selected.length) continue
      const values = nested(item.data, field.split('.')).map(String)
      if (!selected.some(value => values.includes(String(value)))) return false
    }
    return !item.deleted
  }).sort((a, b) => a.name.localeCompare(b.name, 'ru') || a.id - b.id)
}

export async function localHandbookResponse(scope, url) {
  const records = await snapshot(scope)
  const metadata = records.filter(entry => entry.key.endsWith(':metadata')).map(entry => entry.value)
  const allItems = records.filter(entry => entry.key.includes(':item:')).map(entry => entry.value)
  if (!metadata.length) return null
  const params = url.searchParams
  if (url.pathname === '/api/items/by-ids') {
    const ids = (params.get('ids') || '').split(',').map(Number)
    const items = ids.map(id => allItems.find(item => item.id === id)).filter(Boolean)
    return items.length === ids.length ? { items } : null
  }
  if (/^\/api\/items\/\d+$/.test(url.pathname)) return allItems.find(item => item.id === Number(url.pathname.split('/').at(-1))) || null
  if (['/api/items', '/api/items/search'].includes(url.pathname)) {
    const type = metadata.flatMap(value => value.types).find(type => type.id === Number(params.get('typeId')))
    if (!type) return null
    const position = records.find(entry => entry.key === `${scope}handbook:${type.sourceId}:position`)?.value
    if (!position?.complete) return null
    const items = filterLocalItems(allItems, params)
    const offset = Math.max(0, Number(params.get('offset')) || 0)
    const limit = Math.max(1, Math.min(500, Number(params.get('limit')) || 30))
    return { items: items.slice(offset, offset + limit), total: items.length }
  }
  if (url.pathname === '/api/suggest/batch') {
    const all = Object.assign({}, ...metadata.map(value => value.suggests))
    return { items: Object.fromEntries((params.get('typeIds') || '').split(',').map(id => [id, all[id] || []])) }
  }
  const suggest = url.pathname.match(/^\/api\/suggest\/(\d+)(?:\/items)?$/)
  if (suggest) {
    const items = Object.assign({}, ...metadata.map(value => value.suggests))[suggest[1]]
    if (!items) return null
    const ids = params.get('ids')?.split(',').map(Number)
    return { items: ids ? items.filter(item => ids.includes(item.id)) : items }
  }
  return null
}
