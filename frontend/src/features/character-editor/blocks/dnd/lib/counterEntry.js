import { DEFAULT_ICON } from '@/shared/ui/icons/counterIcons'

// Pure helpers for the DND_COUNTERS block value: a flat array of counter tiles
//   { id, name, icon, color, unit, value, max }
// `max: null` means the counter is open-ended (no maximum, no progress bar). `color: ''` means
// no accent. `icon` is a Lucide component name from the curated set (see shared/ui/icons/counterIcons).

let seq = 0
export function makeCounterId() {
  seq += 1
  return 'cnt' + seq.toString(36) + Math.floor(Math.random() * 1e6).toString(36)
}

export function defaultCounter() {
  return { id: makeCounterId(), name: '', icon: DEFAULT_ICON, color: '', unit: '', value: 0, max: null }
}

export function normalizeCounter(c) {
  const src = c && typeof c === 'object' ? c : {}
  const max = src.max == null || src.max === '' ? null : Math.max(1, parseInt(src.max) || 1)
  let value = Math.max(0, parseInt(src.value) || 0)
  if (max != null) value = Math.min(value, max)
  return {
    id: typeof src.id === 'string' && src.id ? src.id : makeCounterId(),
    name: typeof src.name === 'string' ? src.name : '',
    icon: typeof src.icon === 'string' && src.icon ? src.icon : DEFAULT_ICON,
    color: typeof src.color === 'string' ? src.color : '',
    unit: typeof src.unit === 'string' ? src.unit : '',
    value,
    max,
  }
}

export function normalizeCounters(value) {
  if (!Array.isArray(value)) return []
  return value.map(normalizeCounter)
}

// Merge a patch into one counter and keep value/max consistent (value clamped to [0, max]).
export function patchCounter(counter, patch) {
  const next = { ...counter, ...patch }
  next.max = next.max == null || next.max === '' ? null : Math.max(1, parseInt(next.max) || 1)
  next.value = Math.max(0, parseInt(next.value) || 0)
  if (next.max != null) next.value = Math.min(next.value, next.max)
  return next
}
