import { onBeforeUnmount, onBeforeUpdate, onMounted, onUpdated, shallowRef } from 'vue'

export function useWeaponFormulaFlash(root) {
  const flashes = shallowRef([])
  const media = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)')
  let previous = new Map(), ready = false, sequence = 0
  function snapshot() {
    return new Map([...root.value?.querySelectorAll('[data-formula-key]') || []].map(node => [node.dataset.formulaKey,
      { signature: node.dataset.formulaSignature, rect: node.getBoundingClientRect() }]))
  }
  function region(key, rect) {
    const bounds = root.value.getBoundingClientRect()
    const limit = root.value.closest('.weapon-metrics__cell')?.getBoundingClientRect() || bounds
    const left = Math.max(rect.left, limit.left), top = Math.max(rect.top, limit.top)
    const right = Math.min(rect.right, limit.right), bottom = Math.min(rect.bottom, limit.bottom)
    if (right <= left || bottom <= top) return null
    return { id: ++sequence, key, style: { left: `${left - bounds.left}px`, top: `${top - bounds.top}px`,
      width: `${right - left}px`, height: `${bottom - top}px` } }
  }
  onMounted(() => { ready = true; previous = snapshot() })
  onBeforeUpdate(() => { if (ready) previous = snapshot() })
  onUpdated(() => {
    if (!ready || media?.matches || !root.value) return
    const current = snapshot(), changed = []
    for (const [key, value] of current) if (previous.get(key)?.signature !== value.signature) changed.push(region(key, value.rect))
    for (const [key, value] of previous) if (!current.has(key)) changed.push(region(key, value.rect))
    if (changed.length) flashes.value = changed.filter(Boolean)
  })
  function removeFlash(id) { flashes.value = flashes.value.filter(flash => flash.id !== id) }
  const reduce = () => { if (media?.matches) flashes.value = [] }
  media?.addEventListener('change', reduce)
  onBeforeUnmount(() => media?.removeEventListener('change', reduce))
  return { flashes, removeFlash }
}
