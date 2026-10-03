import { onBeforeUnmount, onMounted, ref } from 'vue'

const owners = new WeakMap()

export function useInventoryAnimation() {
  const preference = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
  const reduced = ref(preference?.matches || false)
  const active = new Set()

  function stop() {
    for (const animation of active) animation.cancel()
  }
  function run(element, frames, { kind, duration = 280, easing = 'cubic-bezier(.2,.8,.2,1)', onFinish } = {}) {
    if (reduced.value || !element?.isConnected || !element.animate) return null
    owners.get(element)?.cancel()
    const animation = element.animate(frames, { duration, easing })
    animation.id = `inventory-${kind}`
    element.dataset.inventoryMotion = kind
    owners.set(element, animation)
    active.add(animation)
    const finish = () => {
      active.delete(animation)
      if (owners.get(element) === animation) {
        owners.delete(element)
        delete element.dataset.inventoryMotion
      }
      onFinish?.()
    }
    animation.finished.then(finish, finish)
    return animation
  }
  function changed(event) {
    reduced.value = event.matches
    if (event.matches) stop()
  }
  onMounted(() => preference?.addEventListener('change', changed))
  onBeforeUnmount(() => {
    preference?.removeEventListener('change', changed)
    stop()
  })
  return { run, stop, reduced }
}
