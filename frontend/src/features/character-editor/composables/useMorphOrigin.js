import { ref } from 'vue'

// Shared open/close + origin-rect capture for the morph editor (MorphEditorShell). A block calls
// `open(event)` (or `openFrom(el)`) from any variant's click; the captured rect is what the window
// morphs out of and back to.
export function useMorphOrigin() {
  const editorOpen = ref(false)
  const originRect = ref(null)
  const originEl = ref(null)

  function openFrom(el) {
    if (el) {
      const r = el.getBoundingClientRect()
      originRect.value = { left: r.left, top: r.top, width: r.width, height: r.height }
      originEl.value = el
    }
    editorOpen.value = true
  }
  function open(e) { openFrom(e?.currentTarget || null) }
  function close() { editorOpen.value = false }

  return { editorOpen, originRect, originEl, open, openFrom, close }
}
