import { ref } from 'vue'
import { getByPath, setDeep } from '@/shared/lib/objectPath'
import { useItemTypesStore } from '@/stores/itemTypes'

export { getByPath, setDeep }

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

export function normalizeEncounterPosition(value) {
  return value === 'combat' || value === 'reserve' || value === 'dead' ? value : 'reserve'
}

export function hpAfterDamage(hp = {}, rawAmount = 0) {
  const amount = Math.max(0, Math.floor(Number(rawAmount) || 0))
  const current = Math.max(0, Number(hp.current) || 0)
  const temp = Math.max(0, Number(hp.temp) || 0)
  const absorbed = Math.min(temp, amount)
  return { ...hp, current: Math.max(0, current - (amount - absorbed)), temp: temp - absorbed }
}

export const SIDE_COLOR = {
  enemy:   'var(--side-enemy)',
  ally:    'var(--success)',
  neutral: 'var(--side-neutral)',
  minion:  'var(--side-minion)',
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

export const ENCOUNTER_LETTERS = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ']

export function normalizedEncounterLetter(value) {
  const letter = String(value || '').trim().toUpperCase()
  return ENCOUNTER_LETTERS.includes(letter) ? letter : null
}

export function ensureCombatantLetters(combatants) {
  const npcs = combatants.filter(c => c.type === 'npc')
  const reserved = new Set()
  const preserved = new Set()

  for (const c of npcs) {
    const letter = normalizedEncounterLetter(c.markerLetter)
    if (!letter || reserved.has(letter)) continue
    reserved.add(letter)
    preserved.add(c.uid)
  }

  let changed = false
  for (const c of npcs) {
    const current = normalizedEncounterLetter(c.markerLetter)
    if (preserved.has(c.uid)) {
      if (c.markerLetter !== current) {
        c.markerLetter = current
        changed = true
      }
      continue
    }

    const next = ENCOUNTER_LETTERS.find(letter => !reserved.has(letter)) || null
    if (next) reserved.add(next)
    if (c.markerLetter === next) continue
    if (next) c.markerLetter = next
    else delete c.markerLetter
    changed = true
  }
  return changed
}

export function setCombatantLetter(combatants, uid, value) {
  const target = combatants.find(c => c.uid === uid && c.type === 'npc')
  const next = normalizedEncounterLetter(value)
  if (!target || !next) return false

  const current = normalizedEncounterLetter(target.markerLetter)
  if (current === next) return false

  const occupied = combatants.find(c => c.type === 'npc' && c.uid !== uid && normalizedEncounterLetter(c.markerLetter) === next)
  target.markerLetter = next
  if (occupied) {
    if (current) occupied.markerLetter = current
    else delete occupied.markerLetter
  }
  ensureCombatantLetters(combatants)
  return true
}

export function sideOf(c) {
  return SIDE_COLOR[c.side] ? c.side : 'enemy'
}
