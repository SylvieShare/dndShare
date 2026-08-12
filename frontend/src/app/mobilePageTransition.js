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
let completePendingNavigation = null

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

export function completeMobilePageTransitionNavigation() {
  completePendingNavigation?.()
  completePendingNavigation = null
}

function silenceTransitionRejection(promise) {
  Promise.resolve(promise).catch(() => {})
}

/**
 * Lets vue-router finish navigation inside one root View Transition snapshot.
 * Resolving the returned promise releases the navigation guard; the update
 * callback then waits for router.afterEach and Vue's resulting DOM flush. A
 * requestAnimationFrame must not be awaited here: browsers may pause frames
 * while the View Transition update callback owns the rendering lifecycle.
 */
export function startMobilePageTransition(transitionName, options = {}) {
  const documentObject = options.documentObject ?? globalThis.document
  const root = documentObject.documentElement
  const generation = ++transitionGeneration
  const activeDirectionClass = directionClass(transitionName)

  // A rapid second navigation must never leave the previous update callback
  // waiting for an afterEach notification that now belongs to another route.
  completeMobilePageTransitionNavigation()

  root.classList.remove(...DIRECTION_CLASSES)
  root.classList.add(ROOT_CLASS, activeDirectionClass)
  mobilePageTransitionActive.value = true

  let continueNavigation
  const navigationReady = new Promise(resolve => {
    continueNavigation = resolve
  })
  const navigationCompleted = new Promise(resolve => {
    completePendingNavigation = resolve
  })

  const cleanup = () => {
    if (generation !== transitionGeneration) return
    root.classList.remove(ROOT_CLASS, ...DIRECTION_CLASSES)
    mobilePageTransitionActive.value = false
  }

  try {
    const transition = documentObject.startViewTransition(async () => {
      continueNavigation()
      await navigationCompleted
      await nextTick()
    })
    // `ready` and `updateCallbackDone` reject independently from `finished`.
    // Observe all three so a browser-aborted animation cannot reach the global
    // console-error collector as an unhandled Promise rejection.
    silenceTransitionRejection(transition.ready)
    silenceTransitionRejection(transition.updateCallbackDone)
    Promise.resolve(transition.finished).catch(() => {}).finally(cleanup)
  } catch {
    continueNavigation()
    completeMobilePageTransitionNavigation()
    cleanup()
  }

  return navigationReady
}
