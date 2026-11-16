import { nextTick, onBeforeUnmount, ref } from 'vue'

const SCENE_TRANSITION_MS = 380
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function useEncounterCombatTransition(enc) {
  const transitioning = ref(false)
  const phase = ref('')
  let runId = 0

  function shouldReduceMotion() {
    return typeof window === 'undefined'
      || window.matchMedia?.(REDUCED_MOTION_QUERY).matches
  }

  function cleanup() {
    runId += 1
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
      if (!starting) {
        await nextTick()
        await delay(SCENE_TRANSITION_MS)
      }
      if (currentRun !== runId) return

      enc.toggleCombat()
      await nextTick()
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
