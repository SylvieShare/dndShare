import { onBeforeUnmount } from 'vue'
import { motionTokens } from '@/app/design-tokens'

// Formula terms keep their natural inner layout while their occupied width shrinks.
export function useWeaponFormulaMotion() {
  const active = new Map()
  const media = typeof window === 'undefined' ? null : window.matchMedia('(prefers-reduced-motion: reduce)')
  function restore(node, properties) {
    for (const [name, value] of properties) {
      if (value) node.style.setProperty(name, value)
      else node.style.removeProperty(name)
    }
  }
  function cancel(element) {
    const running = active.get(element)
    if (!running) return
    active.delete(element)
    running.animation.onfinish = null
    running.animation.cancel()
    running.restore()
  }
  function animate(element, entering, done) {
    cancel(element)
    if (media?.matches || !element.animate) { done(); return }
    const bounds = element.getBoundingClientRect()
    const root = ['overflow', 'height', 'flex-shrink'].map(name => [name, element.style.getPropertyValue(name)])
    const children = [...element.children].map(child => ({ child, width: child.getBoundingClientRect().width,
      properties: ['width', 'min-width', 'max-width', 'flex-shrink'].map(name => [name, child.style.getPropertyValue(name)]) }))
    Object.assign(element.style, { overflow: 'hidden', height: `${bounds.height}px`, flexShrink: '0' })
    for (const { child, width } of children) Object.assign(child.style, { width: `${width}px`, minWidth: `${width}px`, maxWidth: 'none', flexShrink: '0' })
    const expanded = { width: `${bounds.width}px`, opacity: 1, transform: 'scale(1)' }
    const collapsed = { width: '0px', opacity: 0, transform: 'scale(.85)' }
    const animation = element.animate(entering ? [collapsed, expanded] : [expanded, collapsed],
      { duration: motionTokens.navigation, easing: 'ease-out', fill: 'both' })
    const finish = () => {
      active.delete(element)
      animation.onfinish = null
      animation.cancel()
      restore(element, root)
      for (const { child, properties } of children) restore(child, properties)
    }
    active.set(element, { animation, restore: () => {
      restore(element, root)
      for (const { child, properties } of children) restore(child, properties)
    } })
    animation.onfinish = () => { finish(); done() }
  }
  const finishAll = () => { if (media?.matches) for (const { animation } of active.values()) animation.finish() }
  media?.addEventListener('change', finishAll)
  onBeforeUnmount(() => {
    media?.removeEventListener('change', finishAll)
    for (const element of [...active.keys()]) cancel(element)
  })
  return { enter: (element, done) => animate(element, true, done), leave: (element, done) => animate(element, false, done), cancel }
}
