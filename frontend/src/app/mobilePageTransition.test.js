import { describe, expect, it } from 'vitest'
import {
  completeMobilePageTransitionNavigation,
  mobilePageTransitionActive,
  shouldUseMobilePageTransition,
  startMobilePageTransition,
} from '@/app/mobilePageTransition'

function mediaWindow({ mobile = true, reduced = false } = {}) {
  return {
    matchMedia(query) {
      return { matches: query.includes('reduced-motion') ? reduced : mobile }
    },
  }
}

function route(path, options = {}) {
  return {
    path,
    name: options.name ?? path,
    meta: options.meta ?? {},
  }
}

describe('mobile page View Transitions', () => {
  it('runs only for full mobile route changes with motion enabled', () => {
    const documentObject = { startViewTransition() {} }
    const from = route('/chars')
    const to = route('/char/test')

    expect(shouldUseMobilePageTransition(to, from, {
      documentObject,
      windowObject: mediaWindow(),
    })).toBe(true)
    expect(shouldUseMobilePageTransition(to, from, {
      documentObject,
      windowObject: mediaWindow({ mobile: false }),
    })).toBe(false)
    expect(shouldUseMobilePageTransition(to, from, {
      documentObject,
      windowObject: mediaWindow({ reduced: true }),
    })).toBe(false)
    expect(shouldUseMobilePageTransition(route('/chars'), from, {
      documentObject,
      windowObject: mediaWindow(),
    })).toBe(false)
    expect(shouldUseMobilePageTransition(route('/char/test/print', { meta: { printView: true } }), from, {
      documentObject,
      windowObject: mediaWindow(),
    })).toBe(false)
  })

  it('keeps navigation inside the backward root snapshot', async () => {
    const classes = new Set()
    const classList = {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
    }
    let updateCallback
    let finishTransition
    const finished = new Promise(resolve => { finishTransition = resolve })
    const ready = Promise.resolve()
    const updateCallbackDone = Promise.resolve()
    const documentObject = {
      documentElement: { classList },
      startViewTransition(callback) {
        updateCallback = callback
        return { finished, ready, updateCallbackDone }
      },
    }

    const navigationReady = startMobilePageTransition('page-backward', {
      documentObject,
    })
    expect(mobilePageTransitionActive.value).toBe(true)
    expect(classes.has('mobile-page-transition--backward')).toBe(true)

    const updateFinished = updateCallback()
    await navigationReady
    let callbackFinished = false
    updateFinished.then(() => { callbackFinished = true })
    await Promise.resolve()
    expect(callbackFinished).toBe(false)

    completeMobilePageTransitionNavigation()
    await updateFinished
    finishTransition()
    await finished
    await Promise.resolve()

    expect(mobilePageTransitionActive.value).toBe(false)
    expect(classes.size).toBe(0)
  })
})
