import { onBeforeUnmount, ref } from 'vue'

const DRAG_THRESHOLD = 4

// Reorder helper for `onDrop`. `toIndex` is already in source-removed coordinates (see updateTarget /
// displayItems), so the moved item is spliced back at exactly `toIndex` — no off-by-one adjustment.
export function reorderByDrop(array, fromIndex, toIndex) {
  if (fromIndex < 0) return array.slice()
  const next = array.slice()
  const [moved] = next.splice(fromIndex, 1)
  next.splice(Math.min(toIndex, next.length), 0, moved)
  return next
}

/**
 * Pointer-event sortable. Returns helpers for binding a drag handle (per item),
 * computing the rendered list (with the source virtually moved to the hover
 * position), and visual flags for source/placeholder styling.
 *
 * config: {
 *   groups: { [name]: { items: Ref<Array>, accepts?: (item, fromGroup, toGroup) => bool } },
 *   getKey: (item) => string|number,
 *   onDrop: ({ item, fromGroup, fromIndex, toGroup, toIndex }) => void,
 *   canDropAt?: ({ item, fromGroup, toGroup, toIndex }) => bool,
 * }
 */
export function useSortable(config) {
  const { groups, getKey, onDrop, canDropAt } = config

  const dragging = ref(false)
  const sourceGroup = ref(null)
  const sourceItem = ref(null)
  const sourceIndex = ref(-1)
  const targetGroup = ref(null)
  const targetIndex = ref(-1)

  let ghostEl = null
  let ghostOffsetX = 0
  let ghostOffsetY = 0
  let pendingStart = null
  let suppressClickUntil = 0

  function startDrag(e, item, groupName, index) {
    if (e.button !== undefined && e.button !== 0) return
    const handle = e.currentTarget
    const sourceEl = handle.closest('[data-sortable-key]')
    if (!sourceEl) return

    pendingStart = { x: e.clientX, y: e.clientY, item, group: groupName, index, sourceEl }
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerEnd)
    document.addEventListener('pointercancel', onPointerEnd)
    window.addEventListener('keydown', onKeyDown)
    e.preventDefault()
  }

  function onPointerMove(e) {
    if (!dragging.value) {
      if (!pendingStart) return
      const dx = e.clientX - pendingStart.x
      const dy = e.clientY - pendingStart.y
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      beginDrag()
    }
    moveGhost(e.clientX, e.clientY)
    updateTarget(e.clientX, e.clientY)
  }

  function beginDrag() {
    const { sourceEl, x, y, item, group, index } = pendingStart
    const rect = sourceEl.getBoundingClientRect()
    ghostOffsetX = x - rect.left
    ghostOffsetY = y - rect.top

    const clone = sourceEl.cloneNode(true)
    let mount = clone
    if (sourceEl.tagName === 'TR') {
      const cells = Array.from(sourceEl.children)
      const widths = cells.map(c => c.getBoundingClientRect().width)
      Array.from(clone.children).forEach((c, i) => {
        c.style.width = widths[i] + 'px'
        c.style.minWidth = widths[i] + 'px'
        c.style.maxWidth = widths[i] + 'px'
      })
      const table = document.createElement('table')
      const tbody = document.createElement('tbody')
      tbody.appendChild(clone)
      table.appendChild(tbody)
      table.style.borderCollapse = 'separate'
      table.style.tableLayout = 'fixed'
      mount = table
    }
    Object.assign(mount.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: rect.width + 'px',
      height: rect.height + 'px',
      pointerEvents: 'none',
      zIndex: '99999',
      margin: '0',
      transition: 'none',
      opacity: '0.92',
      boxShadow: 'var(--shadow-lg)',
      cursor: 'grabbing',
      transformOrigin: 'top left',
    })
    mount.classList.add('sortable-ghost')
    document.body.appendChild(mount)
    ghostEl = mount

    sourceGroup.value = group
    sourceItem.value = item
    sourceIndex.value = index
    targetGroup.value = group
    targetIndex.value = index
    dragging.value = true
    document.body.classList.add('sortable-dragging')

    moveGhost(x, y)
  }

  function moveGhost(x, y) {
    if (!ghostEl) return
    ghostEl.style.transform = `translate3d(${x - ghostOffsetX}px, ${y - ghostOffsetY}px, 0)`
  }

  function updateTarget(x, y) {
    const els = document.elementsFromPoint(x, y)
    let containerEl = null
    let groupName = null
    for (const el of els) {
      const g = el.getAttribute && el.getAttribute('data-sortable-container')
      if (g && groups[g]) {
        containerEl = el
        groupName = g
        break
      }
    }
    if (!groupName) return

    const group = groups[groupName]
    if (group.accepts && !group.accepts(sourceItem.value, sourceGroup.value, groupName)) return

    const sourceKey = sourceItem.value ? String(getKey(sourceItem.value)) : null
    const children = Array.from(containerEl.querySelectorAll(':scope > [data-sortable-key]'))
      .filter(el => el.getAttribute('data-sortable-key') !== sourceKey)

    let idx = children.length
    for (let i = 0; i < children.length; i++) {
      const r = children[i].getBoundingClientRect()
      const middle = r.top + r.height / 2
      if (y < middle) { idx = i; break }
    }

    if (canDropAt && !canDropAt({ item: sourceItem.value, fromGroup: sourceGroup.value, toGroup: groupName, toIndex: idx })) return

    targetGroup.value = groupName
    targetIndex.value = idx
  }

  function onPointerEnd() {
    if (!dragging.value) { cleanup(); return }
    const result = {
      item: sourceItem.value,
      fromGroup: sourceGroup.value,
      fromIndex: sourceIndex.value,
      toGroup: targetGroup.value,
      toIndex: targetIndex.value,
    }
    cleanup()
    if (result.toGroup == null) return
    onDrop?.(result)
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') cleanup()
  }

  function cleanup() {
    const wasDragging = dragging.value
    document.removeEventListener('pointermove', onPointerMove)
    document.removeEventListener('pointerup', onPointerEnd)
    document.removeEventListener('pointercancel', onPointerEnd)
    window.removeEventListener('keydown', onKeyDown)
    if (ghostEl) { ghostEl.remove(); ghostEl = null }
    document.body.classList.remove('sortable-dragging')
    dragging.value = false
    sourceGroup.value = null
    sourceItem.value = null
    sourceIndex.value = -1
    targetGroup.value = null
    targetIndex.value = -1
    pendingStart = null
    if (wasDragging) suppressClickUntil = Date.now() + 250
  }

  function shouldSuppressClick() {
    return Date.now() < suppressClickUntil
  }

  function isSource(item) {
    return dragging.value && sourceItem.value && getKey(sourceItem.value) === getKey(item)
  }

  function displayItems(groupName) {
    const group = groups[groupName]
    if (!group) return []
    const items = group.items.value
    if (!dragging.value) return items
    let result = items
    if (sourceGroup.value === groupName) {
      const srcKey = getKey(sourceItem.value)
      result = items.filter(x => getKey(x) !== srcKey)
    }
    if (targetGroup.value === groupName && sourceItem.value) {
      const idx = Math.min(targetIndex.value, result.length)
      result = [...result.slice(0, idx), sourceItem.value, ...result.slice(idx)]
    }
    return result
  }

  onBeforeUnmount(cleanup)

  return {
    dragging,
    sourceItem,
    sourceGroup,
    targetGroup,
    targetIndex,
    startDrag,
    shouldSuppressClick,
    isSource,
    displayItems,
  }
}
