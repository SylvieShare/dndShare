import { computed, ref } from 'vue'
import { sessionEntityKey } from '@/features/sessions/lib/sessionEntityRelations'

export const SESSION_ENTITY_HISTORY_LIMIT = 10

function storageKey(sessionUuid) {
  return `dnd-share:session-entity-history:v1:${sessionUuid}`
}

function normalizeEntry(entry) {
  if (!entry || !['location', 'npc', 'quest', 'material'].includes(entry.type)) return null
  const id = Number(entry.id)
  if (!Number.isInteger(id) || id <= 0) return null
  return { type: entry.type, id, title: String(entry.title || '').trim() || 'объекту' }
}

function readHistory(sessionUuid) {
  try {
    const raw = globalThis.localStorage?.getItem(storageKey(sessionUuid))
    const parsed = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeEntry).filter(Boolean).slice(-SESSION_ENTITY_HISTORY_LIMIT)
  } catch { return [] }
}

export function useSessionEntityNavigationHistory(sessionUuid) {
  const history = ref(readHistory(sessionUuid))
  const backTarget = computed(() => history.value.at(-1) || null)

  function persist() {
    try { globalThis.localStorage?.setItem(storageKey(sessionUuid), JSON.stringify(history.value)) } catch { /* optional storage */ }
  }

  function push(entry) {
    const normalized = normalizeEntry(entry)
    if (!normalized) return
    const last = history.value.at(-1)
    if (last && sessionEntityKey(last.type, last.id) === sessionEntityKey(normalized.type, normalized.id)) return
    history.value = [...history.value, normalized].slice(-SESSION_ENTITY_HISTORY_LIMIT)
    persist()
  }

  function pop() {
    const target = history.value.at(-1) || null
    if (!target) return null
    history.value = history.value.slice(0, -1)
    persist()
    return target
  }

  function clear() {
    if (!history.value.length) return
    history.value = []
    persist()
  }

  return { history, backTarget, push, pop, clear }
}
