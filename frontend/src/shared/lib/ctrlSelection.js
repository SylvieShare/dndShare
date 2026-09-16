/** Capture before row menus, links and native label/checkbox activation. */
export function handleCtrlSelection(event, enabled, toggle) {
  // On macOS Ctrl + primary click arrives as contextmenu instead of click.
  if (!event.ctrlKey || !enabled || (event.button != null && event.button !== 0 && event.type !== 'contextmenu')) return false
  event.preventDefault()
  event.stopPropagation()
  toggle()
  return true
}
