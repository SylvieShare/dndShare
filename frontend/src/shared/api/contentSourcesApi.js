import { fetchGet } from '@/shared/api/http'

export const DEFAULT_CONTENT_SOURCE_SETTINGS = Object.freeze({
  mode: 'all',
  ids: [],
  allowLegacy: false,
})

export function normalizeContentSourceSettings(value) {
  const mode = value?.mode === 'selected' ? 'selected' : 'all'
  const ids = [...new Set((Array.isArray(value?.ids) ? value.ids : [])
    .map(Number)
    .filter(Number.isFinite))]
  return { mode, ids, allowLegacy: !!value?.allowLegacy }
}

export function contentScopeQuery(settings, sourceVersionId) {
  const normalized = normalizeContentSourceSettings(settings)
  const params = new URLSearchParams()
  if (sourceVersionId != null) params.set('sourceVersionId', String(sourceVersionId))
  if (normalized.mode === 'selected') {
    params.set('contentSourceIds', normalized.ids.join(','))
  }
  if (normalized.allowLegacy) params.set('allowLegacy', 'true')
  const raw = params.toString()
  return raw ? `&${raw}` : ''
}

export const contentSourcesApi = {
  listForVersion(sourceVersionId) {
    if (sourceVersionId == null) return Promise.resolve({ sources: [] })
    return fetchGet(`/content-sources?sourceVersionId=${encodeURIComponent(sourceVersionId)}`)
  },
  listForSystem(sourceId) {
    if (sourceId == null) return Promise.resolve({ sources: [] })
    return fetchGet(`/content-sources?sourceId=${encodeURIComponent(sourceId)}`)
  },
}
