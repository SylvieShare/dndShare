import { nextTick, onBeforeUnmount, ref } from 'vue'

const NPC_FADE_MS = 210
const NPC_STAGGER_MS = 24
const SCENE_TRANSITION_MS = 380
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useEncounterCombatTransition(enc, encounterRoot) {
  const transitioning = ref(false)
  const phase = ref('')
  const runningAnimations = new Set()
  let runId = 0

  function shouldReduceMotion() {
    return typeof window === 'undefined'
      || typeof Element === 'undefined'
      || typeof Element.prototype.animate !== 'function'
      || window.matchMedia?.(REDUCED_MOTION_QUERY).matches
  }

  function selectedReserveNpcRows() {
    const selectedNpcIds = new Set(enc.encounter.combatants
      .filter(combatant =>
        combatant.type === 'npc'
        && combatant.position === 'reserve'
        && enc.selectedUids.has(combatant.uid)
      )
      .map(combatant => String(combatant.uid)))

    if (!selectedNpcIds.size) return []
    return [...(encounterRoot.value?.querySelectorAll(
      '[data-encounter-uid][data-encounter-section="reserve-npc"]'
    ) ?? [])].filter(element => selectedNpcIds.has(element.dataset.encounterUid))
  }

  function fadeReserveNpcsOut() {
    return selectedReserveNpcRows().map((element, index) => {
      const animation = element.animate([
        { opacity: 1, transform: 'translateY(0) scale(1)' },
        { opacity: 0, transform: 'translateY(-5px) scale(0.985)' },
      ], {
        duration: NPC_FADE_MS,
        delay: Math.min(index, 8) * NPC_STAGGER_MS,
        easing: 'cubic-bezier(0.4, 0, 1, 1)',
        fill: 'both',
      })
      runningAnimations.add(animation)
      return animation.finished.catch(() => {})
    })
  }

  function clearAnimations() {
    for (const animation of runningAnimations) animation.cancel()
    runningAnimations.clear()
  }

  function cleanup() {
    runId += 1
    clearAnimations()
    transitioning.value = false
    phase.value = ''
  }

  async function toggleCombat() {
    if (transitioning.value) return
    if (shouldReduceMotion()) {
      enc.toggleCombat()
      return
    }

    const currentRun = ++runId
    const starting = !enc.encounter.active
    transitioning.value = true
    phase.value = starting ? 'starting' : 'ending'

    try {
      if (starting) {
        await Promise.allSettled(fadeReserveNpcsOut())
      } else {
        await nextTick()
        await delay(SCENE_TRANSITION_MS)
      }
      if (currentRun !== runId) return

      enc.toggleCombat()
      await nextTick()
      clearAnimations()
      await delay(starting ? SCENE_TRANSITION_MS : 320)
    } finally {
      if (currentRun === runId) {
        transitioning.value = false
        phase.value = ''
      }
    }
  }

  onBeforeUnmount(cleanup)

  return {
    transitioning,
    phase,
    toggleCombat,
  }
}
