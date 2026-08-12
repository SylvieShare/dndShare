import { nextTick, ref } from 'vue'

const MOBILE_QUERY = '(max-width: 768px)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'
const ROOT_CLASS = 'mobile-page-transition'
const DIRECTION_CLASSES = [
  'mobile-page-transition--forward',
  'mobile-page-transition--backward',
]

export const mobilePageTransitionActive = ref(false)

let transitionGeneration = 0

export function shouldUseMobilePageTransition(to, from, options = {}) {
  const documentObject = options.documentObject ?? globalThis.document
  const windowObject = options.windowObject ?? globalThis.window

  if (!from?.name || to?.path === from?.path) return false
  if (to?.meta?.printView || from?.meta?.printView) return false
  if (typeof documentObject?.startViewTransition !== 'function') return false
  if (typeof windowObject?.matchMedia !== 'function') return false
  if (!windowObject.matchMedia(MOBILE_QUERY).matches) return false
  return !windowObject.matchMedia(REDUCED_MOTION_QUERY).matches
}

function directionClass(transitionName) {
  return transitionName === 'page-backward'
    ? 'mobile-page-transition--backward'
    : 'mobile-page-transition--forward'
}

function nextPaint(windowObject) {
  return new Promise(resolve => {
    if (typeof windowObject?.requestAnimationFrame === 'function') {
      windowObject.requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

/**
 * Lets vue-router finish navigation inside one root View Transition snapshot.
 * Resolving the returned promise releases the navigation guard; the update
 * callback then waits for Vue and the browser to paint the destination route.
 */
export function startMobilePageTransition(transitionName, options = {}) {
  const documentObject = options.documentObject ?? globalThis.document
  const windowObject = options.windowObject ?? globalThis.window
  const root = documentObject.documentElement
  const generation = ++transitionGeneration
  const activeDirectionClass = directionClass(transitionName)

  root.classList.remove(...DIRECTION_CLASSES)
  root.classList.add(ROOT_CLASS, activeDirectionClass)
  mobilePageTransitionActive.value = true

  let continueNavigation
  const navigationReady = new Promise(resolve => {
    continueNavigation = resolve
  })

  const cleanup = () => {
    if (generation !== transitionGeneration) return
    root.classList.remove(ROOT_CLASS, ...DIRECTION_CLASSES)
    mobilePageTransitionActive.value = false
  }

  try {
    const transition = documentObject.startViewTransition(async () => {
      continueNavigation()
      await nextTick()
      await nextPaint(windowObject)
    })
    Promise.resolve(transition.finished).catch(() => {}).finally(cleanup)
  } catch {
    continueNavigation()
    cleanup()
  }

  return navigationReady
}
