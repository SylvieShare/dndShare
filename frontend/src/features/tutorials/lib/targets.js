import { nextTick } from 'vue'

export function visibleTarget(root, name) {
  const scope = typeof root === 'function' ? root() : root
  return [...(scope?.querySelectorAll(`[data-tutorial="${name}"]`) || [])].find(element => {
    if (!element.getClientRects().length) return false
    for (let parent = element; parent && parent !== scope; parent = parent.parentElement) {
      const style = getComputedStyle(parent)
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false
    }
    return true
  }) || null
}

// Actions are registered by feature components; no arbitrary selector.click().
export function createTutorialActions() {
  const actions = new Map()
  return {
    register(name, action) { actions.set(name, action); return () => { if (actions.get(name) === action) actions.delete(name) } },
    async run(name, context) {
      const action = actions.get(name)
      if (!action) throw new Error(`Missing tutorial action: ${name}`)
      await action(context)
      await nextTick()
    },
  }
}
export const tutorialActionsKey = Symbol('tutorial-actions')
