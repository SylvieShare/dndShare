import { computed, ref, watch } from 'vue'

export function useSessionParticipantRail({ sessionUuid, workspaceMotionMode }) {
  const storageKey = `dnd-share:session-players-rail:v1:${sessionUuid}`
  const collapsed = ref(readCollapsed())
  const mode = computed(() => workspaceMotionMode.value === 'combat'
    ? 'combat'
    : collapsed.value ? 'compact' : 'normal')

  watch(collapsed, value => {
    try {
      localStorage.setItem(storageKey, value ? 'collapsed' : 'normal')
    } catch { /* localStorage can be unavailable in private mode */ }
  })

  function readCollapsed() {
    try {
      return localStorage.getItem(storageKey) === 'collapsed'
    } catch {
      return false
    }
  }

  function toggle() {
    if (mode.value === 'combat') return
    collapsed.value = !collapsed.value
  }

  return { collapsed, mode, toggle }
}
