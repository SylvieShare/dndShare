import { onBeforeUnmount, onMounted, toValue } from 'vue'
import {
  SESSION_COMBAT_SHIFT_SHORTCUTS,
  SESSION_COMBAT_TURN_SHORTCUTS,
  SESSION_DICE_SHORTCUTS,
  SESSION_LIST_SHORTCUTS,
  SESSION_PANEL_SHORTCUTS,
  SESSION_VIEW_SHORTCUTS,
} from '@/features/sessions/lib/sessionShortcuts'

const EDITABLE_TARGET = 'input, textarea, select, [contenteditable="true"]'
const LIST_SEARCH_TARGET = '.session-world-search input[type="search"]'
const FLOATING_UI = '.share-popover, [role="dialog"]'
const NATIVE_ACTIVATION_TARGET = 'button, a[href], [role="button"]'

export function sessionHotkeyCommand(event) {
  const helpKey = event.key === '?' || (event.code === 'Slash' && event.shiftKey)
  if (helpKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
    return { type: 'toggle-hints' }
  }
  if (event.key === 'Escape') return { type: 'hide-hints' }

  if (event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    const view = Object.entries(SESSION_VIEW_SHORTCUTS).find(([, code]) => code === event.code)?.[0]
    if (view) return { type: 'select-view', value: view }
  }
  if (!event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
    const panel = Object.entries(SESSION_PANEL_SHORTCUTS).find(([, code]) => code === event.code)?.[0]
    if (panel) return { type: 'toggle-panel', value: panel }
    const combatCommand = SESSION_COMBAT_SHIFT_SHORTCUTS[event.code]
    if (combatCommand) return { type: combatCommand }
  }

  if (event.altKey && event.shiftKey && !event.ctrlKey && !event.metaKey) {
    const die = SESSION_DICE_SHORTCUTS.find(shortcut => shortcut.code === event.code)
    if (die) return { type: 'roll-die', value: die.sides }
  }
  if (!event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
    const listCommand = SESSION_LIST_SHORTCUTS[event.code]
    if (listCommand) return { type: listCommand }
    const combatCommand = SESSION_COMBAT_TURN_SHORTCUTS[event.code]
    if (combatCommand) return { type: combatCommand }
  }
  return null
}

export function useSessionHotkeys({
  enabled,
  canSwitchView,
  showHints,
  selectView,
  togglePanel,
  rollDie,
  listMode,
  previousListItem,
  nextListItem,
  combatMode,
  canControlCombat,
  toggleCombatWorkspace,
  toggleEncounter,
  previousTurn,
  nextTurn,
  togglePlayerSelection,
  toggleNpcSelection,
  toggleSceneSelection,
  rerollInitiative,
  removeSelectedNpcs,
}) {
  function onKey(event) {
    if (!toValue(enabled) || event.repeat) return

    const command = sessionHotkeyCommand(event)
    if (!command) return
    const listNavigation = command.type === 'previous-list-item' || command.type === 'next-list-item'
    const navigatesSearchResults = listNavigation
      && toValue(listMode)
      && event.target?.matches?.(LIST_SEARCH_TARGET)
    if (event.target?.closest?.(EDITABLE_TARGET) && !navigatesSearchResults) return
    if (document.querySelector(FLOATING_UI)) return
    if (command.type === 'toggle-encounter' && event.target?.closest?.(NATIVE_ACTIVATION_TARGET)) return
    if (command.type === 'toggle-hints') {
      event.preventDefault()
      showHints.value = !showHints.value
      return
    }

    if (command.type === 'hide-hints' && showHints.value) showHints.value = false
    if (command.type === 'select-view' && toValue(canSwitchView)) {
      event.preventDefault()
      selectView(command.value)
      return
    }
    if (command.type === 'toggle-panel') {
      event.preventDefault()
      togglePanel(command.value)
      return
    }
    if (command.type === 'roll-die') {
      event.preventDefault()
      rollDie(command.value)
      return
    }
    if (toValue(listMode) && command.type === 'previous-list-item') {
      event.preventDefault()
      previousListItem()
      return
    }
    if (toValue(listMode) && command.type === 'next-list-item') {
      event.preventDefault()
      nextListItem()
      return
    }
    if (command.type === 'toggle-combat-workspace') {
      event.preventDefault()
      toggleCombatWorkspace()
      return
    }
    if (!toValue(combatMode) || !toValue(canControlCombat)) return

    const combatActions = {
      'toggle-encounter': toggleEncounter,
      'previous-turn': previousTurn,
      'next-turn': nextTurn,
      'toggle-player-selection': togglePlayerSelection,
      'toggle-npc-selection': toggleNpcSelection,
      'toggle-scene-selection': toggleSceneSelection,
      'reroll-initiative': rerollInitiative,
      'remove-selected-npcs': removeSelectedNpcs,
    }
    const combatAction = combatActions[command.type]
    if (combatAction) {
      event.preventDefault()
      combatAction()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { onKey }
}
