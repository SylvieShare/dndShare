import { ref } from 'vue'
import { useItemTypesStore } from '@/stores/itemTypes'

export const BESTIARY_TYPE_ID = 6
export const SAVE_DEBOUNCE_MS = 500

export const bestiaryTypeRef = ref(null)
let bestiaryTypePromise = null

export function ensureBestiaryType() {
  if (bestiaryTypeRef.value) return
  if (bestiaryTypePromise) return
  bestiaryTypePromise = useItemTypesStore().ensureType(BESTIARY_TYPE_ID)
    .then(t => { bestiaryTypeRef.value = t || null })
    .catch(() => {})
}

export function makeUid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function getByPath(obj, path) {
  if (!path) return null
  return path.split('.').reduce((cur, key) => cur?.[key], obj) ?? null
}

export function setDeep(obj, path, value) {
  const parts = String(path).split('.')
  let cur = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i]
    if (cur[k] == null || typeof cur[k] !== 'object') cur[k] = {}
    cur = cur[k]
  }
  cur[parts[parts.length - 1]] = value
}

export function nextTieBreak(combatants) {
  return combatants.reduce((m, c) => Math.max(m, c.tieBreak ?? 0), 0) + 1
}

export function initRank(c) {
  return c.initiative == null ? Number.NEGATIVE_INFINITY : c.initiative
}

export function matchesGroup(c, group) {
  if (group === 'combat') return c.position === 'combat'
  if (group === 'reserve-npc') return c.position === 'reserve' && c.type === 'npc'
  if (group === 'reserve-player') return c.position === 'reserve' && c.type === 'player'
  if (group === 'dead') return c.position === 'dead'
  return false
}

export const SIDE_COLOR = {
  enemy:   '#e85c8a',
  ally:    '#5ce87c',
  neutral: '#8888aa',
  minion:  '#a06ce8',
}

export const SIDE_LABEL = {
  enemy:   'ВРАГ',
  ally:    'СОЮЗНИК',
  neutral: 'НЕЙТРАЛ',
  minion:  'ПРИСПЕШНИК',
}

export const SIDE_OPTIONS = [
  { value: 'enemy',   label: 'Враг' },
  { value: 'ally',    label: 'Союзник' },
  { value: 'neutral', label: 'Нейтрал' },
  { value: 'minion',  label: 'Приспешник' },
]

export const ICON_COLOR_SWATCHES = [
  '#e85c5c', '#e85c8a', '#e0508a', '#c25fb0',
  '#a06ce8', '#7c5cff', '#5c7ce8', '#5cb0e8',
  '#5cd0c8', '#5ce8a8', '#5ce87c', '#a8e85c',
  '#f5e85c', '#f5b94a', '#e89c3c', '#e8763c',
  '#a8722e', '#8888aa', '#e8e8ef', '#404050',
]

export function sideOf(c) {
  return SIDE_COLOR[c.side] ? c.side : 'enemy'
}
