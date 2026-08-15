import { onBeforeUnmount, onMounted, toValue } from 'vue'

const EDITABLE_TARGET = 'input, textarea, select, [contenteditable="true"]'
const FLOATING_UI = '.share-popover, [role="dialog"]'

export function useGraphHotkeys({ enabled, selectedNodes, selectAll, clearSelection, cancelGesture, deleteSelection, zoomBy }) {
  function onKey(event) {
    if (!toValue(enabled) || event.target?.closest?.(EDITABLE_TARGET)) return
    if (document.querySelector(FLOATING_UI)) return

    const modifier = event.ctrlKey || event.metaKey
    if (modifier && (event.code === 'KeyA' || event.key.toLowerCase() === 'a')) {
      event.preventDefault()
      selectAll()
      return
    }
    if (!modifier && ['Delete', 'Backspace'].includes(event.key) && selectedNodes.value.length) {
      event.preventDefault()
      deleteSelection(selectedNodes.value.map(node => node.id))
      return
    }
    if (!modifier && (['+', '='].includes(event.key) || ['Equal', 'NumpadAdd'].includes(event.code))) {
      event.preventDefault()
      zoomBy(1.15)
      return
    }
    if (!modifier && (['-', '_'].includes(event.key) || ['Minus', 'NumpadSubtract'].includes(event.code))) {
      event.preventDefault()
      zoomBy(1 / 1.15)
      return
    }
    if (event.key === 'Escape') {
      cancelGesture()
      clearSelection()
    }
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
}
