import { ICON_COLOR_SWATCHES } from '@/features/sessions/lib/encounterHelpers'

export const DIALOGUE_COLOR_POOL = ICON_COLOR_SWATCHES.slice(0, 16)

export function normalizeDialogueKey(value) {
  return String(value || '').trim().toLocaleLowerCase('ru-RU')
}

export function hydrateDialogueRows(rows) {
  const keyColors = new Map()
  const usedColors = new Set()
  return (Array.isArray(rows) ? rows : []).map((source, index) => {
    const left = String(source?.left ?? '')
    const right = String(source?.right ?? '')
    const key = normalizeDialogueKey(left)
    let color = keyColors.get(key) || ''
    if (key && !color) {
      const savedColor = String(source?.color || '')
      color = savedColor && !usedColors.has(savedColor)
        ? savedColor
        : DIALOGUE_COLOR_POOL.find(candidate => !usedColors.has(candidate)) || DIALOGUE_COLOR_POOL[index % DIALOGUE_COLOR_POOL.length]
      keyColors.set(key, color)
      usedColors.add(color)
    }
    return { left, right, color }
  })
}

export function dialogueKeySuggestions(rows) {
  const names = new Map()
  for (const row of rows || []) {
    const value = String(row?.left || '').trim()
    const key = normalizeDialogueKey(value)
    if (key && !names.has(key)) names.set(key, value)
  }
  return [...names.values()]
}

export function applyDialogueKeyColor(rows, keyValue, color) {
  const key = normalizeDialogueKey(keyValue)
  if (!key) return rows
  for (const row of rows || []) {
    if (normalizeDialogueKey(row?.left) === key) row.color = color
  }
  return rows
}

export function pickDialogueColor(rows, activeRow, random = Math.random) {
  const key = normalizeDialogueKey(activeRow?.left)
  if (!key) return ''
  const matchingRow = (rows || []).find(row => row !== activeRow && normalizeDialogueKey(row?.left) === key && row?.color)
  if (matchingRow) return matchingRow.color

  const used = new Set((rows || [])
    .filter(row => row !== activeRow && normalizeDialogueKey(row?.left) !== key)
    .map(row => row?.color)
    .filter(Boolean))
  const available = DIALOGUE_COLOR_POOL.filter(color => !used.has(color))
  const pool = available.length ? available : DIALOGUE_COLOR_POOL
  return pool[Math.floor(random() * pool.length)] || DIALOGUE_COLOR_POOL[0]
}
