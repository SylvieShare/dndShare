import { nextTick, onBeforeUnmount, ref } from 'vue'

const MOVE_DURATION_MS = 560
const LAND_DURATION_MS = 260
const STAGGER_MS = 38
const MAX_STAGGER_STEPS = 8
const SAFETY_TIMEOUT_MS = 1200
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function afterLayout() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
}

function elementRect(element) {
  const rect = element?.getBoundingClientRect?.()
  if (!rect || rect.width <= 0 || rect.height <= 0) return null
  return rect
}

function findByData(root, key, value, section = null) {
  if (!root) return null
  const attribute = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
  const selector = section
    ? `[data-${attribute}][data-encounter-section="${section}"]`
    : `[data-${attribute}]`
  return [...root.querySelectorAll(selector)].find(element => element.dataset[key] === String(value)) ?? null
}

function cloneForFlight(element, rect) {
  const clone = element.cloneNode(true)
  clone.setAttribute('aria-hidden', 'true')
  clone.querySelectorAll('[id]').forEach(child => child.removeAttribute('id'))
  Object.assign(clone.style, {
    position: 'fixed',
    zIndex: '10020',
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: '0',
    pointerEvents: 'none',
    willChange: 'left, top, width, height, opacity, filter',
  })
  return clone
}

export function useEncounterCombatTransition(enc, encounterRoot) {
  const transitioning = ref(false)
  const phase = ref('')
  const runningAnimations = new Set()
  const flightClones = new Set()
  const hiddenTargets = new Map()

  function findRow(uid, section) {
    return findByData(encounterRoot.value, 'encounterUid', uid, section)
  }

  function findPlayer(uid) {
    return findByData(document, 'encounterPlayerUid', uid)
  }

  function sourceElement(combatant, starting) {
    if (!starting) return findRow(combatant.uid, 'combat')
    if (combatant.type === 'player') return findPlayer(combatant.uid)
    return findRow(combatant.uid, 'reserve-npc')
  }

  function targetElement(combatant, starting) {
    if (starting) return findRow(combatant.uid, 'combat')
    if (combatant.type === 'player') return findPlayer(combatant.uid)
    return findRow(combatant.uid, 'reserve-npc')
  }

  function shouldReduceMotion() {
    return typeof window === 'undefined'
      || typeof Element === 'undefined'
      || typeof Element.prototype.animate !== 'function'
      || window.matchMedia?.(REDUCED_MOTION_QUERY).matches
  }

  function rememberHiddenTarget(element) {
    if (hiddenTargets.has(element)) return
    hiddenTargets.set(element, {
      opacity: element.style.opacity,
      pointerEvents: element.style.pointerEvents,
    })
    element.style.opacity = '0'
    element.style.pointerEvents = 'none'
  }

  function restoreTargets() {
    for (const [element, previous] of hiddenTargets) {
      element.style.opacity = previous.opacity
      element.style.pointerEvents = previous.pointerEvents
    }
    hiddenTargets.clear()
  }

  function cleanup() {
    for (const animation of runningAnimations) animation.cancel()
    runningAnimations.clear()
    for (const clone of flightClones) clone.remove()
    flightClones.clear()
    restoreTargets()
    transitioning.value = false
    phase.value = ''
  }

  function track(animation) {
    runningAnimations.add(animation)
    return animation.finished.catch(() => {})
  }

  function flightAnimation(clone, from, to, delayMs) {
    return clone.animate([
      {
        left: `${from.left}px`,
        top: `${from.top}px`,
        width: `${from.width}px`,
        height: `${from.height}px`,
        opacity: 1,
        filter: 'drop-shadow(0 2px 5px transparent)',
      },
      {
        offset: 0.72,
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 0.96,
        filter: 'drop-shadow(0 12px 18px rgba(0, 0, 0, 0.28))',
      },
      {
        left: `${to.left}px`,
        top: `${to.top}px`,
        width: `${to.width}px`,
        height: `${to.height}px`,
        opacity: 0,
        filter: 'drop-shadow(0 4px 8px transparent)',
      },
    ], {
      duration: MOVE_DURATION_MS,
      delay: delayMs,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    })
  }

  function landingAnimation(target, delayMs) {
    return target.animate([
      { opacity: 0, transform: 'translateY(9px) scale(0.985)' },
      { opacity: 1, transform: 'translateY(0) scale(1)' },
    ], {
      duration: LAND_DURATION_MS,
      delay: delayMs + Math.round(MOVE_DURATION_MS * 0.58),
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      fill: 'both',
    })
  }

  function dimPersistentPlayerSource(element, delayMs) {
    return element.animate([
      { opacity: 1 },
      { offset: 0.18, opacity: 0.42 },
      { offset: 0.68, opacity: 0.42 },
      { opacity: 1 },
    ], {
      duration: MOVE_DURATION_MS,
      delay: delayMs,
      easing: 'ease-out',
    })
  }

  async function toggleCombat() {
    if (transitioning.value) return

    const starting = !enc.encounter.active
    const combatants = starting
      ? enc.encounter.combatants.filter(combatant =>
          enc.selectedUids.has(combatant.uid) && combatant.position !== 'dead'
        )
      : [...enc.inCombat]

    if (shouldReduceMotion() || combatants.length === 0) {
      enc.toggleCombat()
      return
    }

    const snapshots = combatants.map(combatant => {
      const source = sourceElement(combatant, starting)
      const from = elementRect(source)
      return source && from
        ? { combatant, source, from, clone: cloneForFlight(source, from) }
        : null
    }).filter(Boolean)

    transitioning.value = true
    phase.value = starting ? 'starting' : 'ending'
    enc.toggleCombat()

    try {
      await nextTick()
      const targets = snapshots.map(snapshot => {
        const target = targetElement(snapshot.combatant, starting)
        if (target) rememberHiddenTarget(target)
        return target ? { ...snapshot, target } : null
      }).filter(Boolean)
      await afterLayout()

      const pairs = targets.map(snapshot => {
        const to = elementRect(snapshot.target)
        return to ? { ...snapshot, to } : null
      }).filter(Boolean)

      if (!pairs.length) return

      const promises = []
      pairs.forEach((pair, index) => {
        const delayMs = Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS
        document.body.appendChild(pair.clone)
        flightClones.add(pair.clone)
        promises.push(track(flightAnimation(pair.clone, pair.from, pair.to, delayMs)))
        promises.push(track(landingAnimation(pair.target, delayMs)))
        if (starting && pair.combatant.type === 'player' && pair.source.isConnected) {
          promises.push(track(dimPersistentPlayerSource(pair.source, delayMs)))
        }
      })

      await Promise.race([
        Promise.allSettled(promises),
        delay(SAFETY_TIMEOUT_MS),
      ])
    } finally {
      cleanup()
    }
  }

  onBeforeUnmount(cleanup)

  return {
    transitioning,
    phase,
    toggleCombat,
  }
}
