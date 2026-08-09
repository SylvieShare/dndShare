import { markRaw } from 'vue'
import { MessagesSquare, Sparkles, Sunrise, Swords } from '@lucide/vue'

// Pure helpers for the DND_DIARY block value: a chronological array of sessions
//   { id, title, date, events: [{ id, type, title, desc }] }
// `type` is one of EVENT_TYPES values; unknown types normalize to 'event'.
// 'newday' renders as a day separator in the timeline, the rest as regular entries.

export const EVENT_TYPES = [
  { value: 'battle', label: 'Бой', color: 'var(--danger)', icon: markRaw(Swords) },
  { value: 'dialog', label: 'Диалог', color: 'var(--accent)', icon: markRaw(MessagesSquare) },
  { value: 'event', label: 'Событие', color: 'var(--accent)', icon: markRaw(Sparkles) },
  { value: 'newday', label: 'Новый день', color: 'var(--warning)', icon: markRaw(Sunrise) },
]

const TYPE_VALUES = EVENT_TYPES.map(t => t.value)

export function eventTypeMeta(type) {
  return EVENT_TYPES.find(t => t.value === type) || EVENT_TYPES[2]
}

let seq = 0
function makeId(prefix) {
  seq += 1
  return prefix + seq.toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

export function makeSessionId() { return makeId('ses') }
export function makeEventId() { return makeId('evt') }

export function defaultSession() {
  return { id: makeSessionId(), title: '', date: '', events: [] }
}

export function defaultEvent() {
  return { id: makeEventId(), type: 'event', title: '', desc: '' }
}

export function normalizeEvent(e) {
  const src = e && typeof e === 'object' ? e : {}
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeEventId(),
    type: TYPE_VALUES.includes(src.type) ? src.type : 'event',
    title: typeof src.title === 'string' ? src.title : '',
    desc: typeof src.desc === 'string' ? src.desc : '',
  }
}

export function normalizeSession(s) {
  const src = s && typeof s === 'object' ? s : {}
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeSessionId(),
    title: typeof src.title === 'string' ? src.title : '',
    date: typeof src.date === 'string' ? src.date : '',
    events: Array.isArray(src.events) ? src.events.map(normalizeEvent) : [],
  }
}

export function normalizeDiary(value) {
  if (!Array.isArray(value)) return []
  return value.map(normalizeSession)
}

export function patchEvent(event, patch) {
  return normalizeEvent({ ...event, ...patch })
}

export function patchSession(session, patch) {
  return normalizeSession({ ...session, ...patch })
}
