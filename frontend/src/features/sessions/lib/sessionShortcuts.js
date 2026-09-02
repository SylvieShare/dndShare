export const SESSION_VIEW_SHORTCUTS = Object.freeze({
  story: 'Digit1',
  locations: 'Digit2',
  npcs: 'Digit3',
  quests: 'Digit4',
  materials: 'Digit5',
  music: 'Digit6',
})

export const SESSION_PANEL_SHORTCUTS = Object.freeze({
  dice: 'KeyD',
  events: 'KeyL',
})

export const SESSION_DICE_SHORTCUTS = Object.freeze([
  { code: 'Digit1', sides: 4 },
  { code: 'Digit2', sides: 6 },
  { code: 'Digit3', sides: 8 },
  { code: 'Digit4', sides: 10 },
  { code: 'Digit5', sides: 12 },
  { code: 'Digit6', sides: 20 },
  { code: 'Digit7', sides: 100 },
])

export const SESSION_COMBAT_SHIFT_SHORTCUTS = Object.freeze({
  KeyB: 'toggle-combat-workspace',
  Enter: 'toggle-encounter',
  KeyP: 'toggle-player-selection',
  KeyN: 'toggle-npc-selection',
  KeyA: 'toggle-scene-selection',
  KeyR: 'reroll-initiative',
})

export const SESSION_COMBAT_TURN_SHORTCUTS = Object.freeze({
  ArrowLeft: 'previous-turn',
  ArrowRight: 'next-turn',
  Backspace: 'remove-selected-npcs',
})

export const SESSION_LIST_SHORTCUTS = Object.freeze({
  ArrowUp: 'previous-list-item',
  ArrowDown: 'next-list-item',
})

export function sessionShortcutLabels(platform = globalThis.navigator?.platform || '') {
  const mac = /Mac|iPhone|iPad/.test(platform)
  return {
    alt: mac ? '⌥' : 'Alt',
    dice: mac ? '⌥⇧' : 'Alt+Shift',
    panel: mac ? '⇧' : 'Shift',
  }
}
