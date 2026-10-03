import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { inventoryMembershipChanges } from '../lib/inventoryMotion'
import { useInventoryAnimation } from './useInventoryAnimation'

export function useInventoryGridMotion(grid, layer, props) {
  const motion = useInventoryAnimation()
  const heldCellCount = ref(0), leaving = new Set()
  let mounted = false
  const snapshot = () => {
    const rows = props.entries.map(entry => ({ key: String(props.getKey(entry)), entry }))
    return { rows, keys: new Set((props.allItemKeys || rows.map(row => row.key)).map(String)) }
  }
  const elements = () => new Map([...(grid.value?.querySelectorAll('[data-sortable-key]') || [])]
    .map(element => [element.dataset.sortableKey, element]))
  function releaseRows() {
    if (!leaving.size && !props.sortable?.dragging) heldCellCount.value = 0
  }
  function removeVisual(element, cellCount) {
    if (!element || !layer.value) return
    const bounds = element.getBoundingClientRect(), origin = grid.value.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return
    const ghost = element.cloneNode(true)
    ghost.inert = true
    ghost.setAttribute('aria-hidden', 'true')
    ghost.classList.remove('inventory-bag-item--draggable', 'inventory-bag-item--source', 'action-menu-source--open')
    ghost.querySelectorAll('.inventory-bag-item__feedback').forEach(node => node.remove())
    for (const node of [ghost, ...ghost.querySelectorAll('[data-sortable-key], [data-inventory-motion]')]) {
      node.removeAttribute('data-sortable-key')
      node.removeAttribute('data-inventory-motion')
    }
    Object.assign(ghost.style, {
      position: 'absolute', left: `${bounds.left - origin.left}px`, top: `${bounds.top - origin.top}px`,
      width: `${bounds.width}px`, height: `${bounds.height}px`, pointerEvents: 'none',
    })
    layer.value.append(ghost)
    heldCellCount.value = Math.max(heldCellCount.value, cellCount)
    leaving.add(ghost)
    const finish = () => { ghost.remove(); leaving.delete(ghost); releaseRows() }
    const animation = motion.run(ghost, [
      { opacity: 1, transform: 'scale(1) translateY(0)' },
      { opacity: 0, transform: 'scale(.55) translateY(8px)' },
    ], { kind: 'remove-item', duration: 260, onFinish: finish })
    if (!animation) finish()
  }
  watch(snapshot, async (next, previous) => {
    if (!mounted || motion.reduced.value || props.sortable?.dragging) return
    const changes = inventoryMembershipChanges(previous, next)
    if (changes.removed.length) {
      const previousElements = elements()
      const cellCount = grid.value.querySelectorAll(':scope > .inventory-bag-cell').length
      for (const key of changes.removed) removeVisual(previousElements.get(key), cellCount)
    }
    if (!changes.added.length) return
    await nextTick()
    if (!mounted || motion.reduced.value || props.sortable?.dragging) return
    const currentElements = elements()
    for (const key of changes.added) {
      const element = currentElements.get(key)
      if (!element?.getBoundingClientRect().width) continue
      motion.run(element.querySelector('.inventory-bag-item__art'), [
        { opacity: 0, transform: 'scale(.65)' },
        { opacity: 1, transform: 'scale(1.1)', offset: .7 },
        { opacity: 1, transform: 'scale(1)' },
      ], { kind: 'add-item', duration: 320 })
      motion.run(element.querySelector('.inventory-bag-item__footer'), [{ opacity: 0 }, { opacity: 1 }], { kind: 'add-item-footer' })
    }
  }, { flush: 'pre' })
  watch(() => props.sortable?.dragging, releaseRows)
  onMounted(() => { mounted = true })
  onBeforeUnmount(() => { mounted = false })
  return { heldCellCount, stop: motion.stop }
}
