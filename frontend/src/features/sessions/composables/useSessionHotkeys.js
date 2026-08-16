import { onBeforeUnmount, onMounted, toValue } from 'vue'
import {
  SESSION_COMBAT_SHIFT_SHORTCUTS,
  SESSION_COMBAT_TURN_SHORTCUTS,
  SESSION_DICE_SHORTCUTS,
  SESSION_PANEL_SHORTCUTS,
  SESSION_VIEW_SHORTCUTS,
} from '@/features/sessions/lib/sessionShortcuts'

const EDITABLE_TARGET = 'input, textarea, select, [contenteditable="true"]'
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
}) {
  function onKey(event) {
    if (!toValue(enabled) || event.repeat || event.target?.closest?.(EDITABLE_TARGET)) return

    const command = sessionHotkeyCommand(event)
    if (!command) return
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
