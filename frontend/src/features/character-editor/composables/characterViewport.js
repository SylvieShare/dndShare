import { watch } from 'vue'

export function measureCharacterViewport(windowObject, documentElement) {
  return {
    layoutHeight: Math.max(
      Number(windowObject?.innerHeight) || 0,
      Number(documentElement?.clientHeight) || 0,
    ),
    visualHeight: Number(windowObject?.visualViewport?.height) || 0,
  }
}

export function resolveCharacterViewportHeight(measurement, lockedHeight = 0) {
  if (lockedHeight > 0) return lockedHeight
  return measurement.visualHeight || measurement.layoutHeight
}

export function hasCharacterViewportRecovered(measurement, lockedHeight, tolerance = 120) {
  if (!lockedHeight) return true
  const currentHeight = resolveCharacterViewportHeight(measurement)
  return currentHeight >= lockedHeight - tolerance
}

export function useCharacterViewport(isMobile, options = {}) {
  const windowObject = options.windowObject || window
  const documentObject = options.documentObject || document
  const documentElement = documentObject.documentElement

  let lockedHeight = 0
  let heightTimer = null
  let recoveryTimer = null
  let stopMobileWatch = null
  let started = false

  function isEditableElement(el) {
    return !!el?.matches?.('input, textarea, select, [contenteditable="true"]')
  }

  function measurement() {
    return measureCharacterViewport(windowObject, documentElement)
  }

  function updateHeight() {
    const height = resolveCharacterViewportHeight(measurement(), lockedHeight)
    if (!height) return
    documentElement.style.setProperty('--character-viewport-height', `${Math.round(height)}px`)
  }

  function scheduleHeightUpdate() {
    updateHeight()
    clearTimeout(heightTimer)
    heightTimer = setTimeout(updateHeight, 250)
  }

  function onViewportChange() {
    const currentMeasurement = measurement()
    if (
      lockedHeight &&
      !isEditableElement(documentObject.activeElement) &&
      hasCharacterViewportRecovered(currentMeasurement, lockedHeight)
    ) {
      lockedHeight = 0
    }
    scheduleHeightUpdate()
  }

  function onOrientationChange() {
    clearTimeout(recoveryTimer)
    recoveryTimer = setTimeout(() => {
      lockedHeight = 0
      scheduleHeightUpdate()
    }, 250)
  }

  function onFocusIn(event) {
    if (!isMobile.value || !isEditableElement(event.target)) return
    clearTimeout(recoveryTimer)
    if (!lockedHeight) {
      lockedHeight = resolveCharacterViewportHeight(measurement())
    }
    updateHeight()
  }

  function onFocusOut(event) {
    if (!isMobile.value || !isEditableElement(event.target)) return
    clearTimeout(recoveryTimer)
    recoveryTimer = setTimeout(() => {
      if (isEditableElement(documentObject.activeElement)) return

      // Mobile Safari can leave the layout viewport panned after a teleported
      // contenteditable loses focus. Character content has its own nested
      // scroller, so only the outer window is restored here.
      if (windowObject.scrollY) windowObject.scrollTo(0, 0)
      const currentMeasurement = measurement()
      if (hasCharacterViewportRecovered(currentMeasurement, lockedHeight)) {
        lockedHeight = 0
      }
      scheduleHeightUpdate()
    }, 600)
  }

  function startViewportHeightSync() {
    if (started) return
    started = true
    updateHeight()
    windowObject.visualViewport?.addEventListener('resize', onViewportChange, { passive: true })
    windowObject.visualViewport?.addEventListener('scroll', onViewportChange, { passive: true })
    windowObject.addEventListener('resize', onViewportChange, { passive: true })
    windowObject.addEventListener('orientationchange', onOrientationChange, { passive: true })
    // MorphSheet is teleported to body, outside ViewCharacter. Capture focus
    // at document scope while the page is mounted so the height is locked
    // before visualViewport shrinks for the software keyboard.
    documentObject.addEventListener('focusin', onFocusIn, true)
    documentObject.addEventListener('focusout', onFocusOut, true)
    stopMobileWatch = watch(isMobile, mobile => {
      if (!mobile) lockedHeight = 0
      scheduleHeightUpdate()
    }, { flush: 'sync' })
  }

  function stopViewportHeightSync() {
    if (!started) return
    started = false
    clearTimeout(heightTimer)
    clearTimeout(recoveryTimer)
    windowObject.visualViewport?.removeEventListener('resize', onViewportChange)
    windowObject.visualViewport?.removeEventListener('scroll', onViewportChange)
    windowObject.removeEventListener('resize', onViewportChange)
    windowObject.removeEventListener('orientationchange', onOrientationChange)
    documentObject.removeEventListener('focusin', onFocusIn, true)
    documentObject.removeEventListener('focusout', onFocusOut, true)
    stopMobileWatch?.()
    stopMobileWatch = null
    documentElement.style.removeProperty('--character-viewport-height')
    lockedHeight = 0
  }

  return {
    startViewportHeightSync,
    stopViewportHeightSync,
  }
}
