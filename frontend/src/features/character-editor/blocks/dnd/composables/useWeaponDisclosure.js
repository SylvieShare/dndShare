import { computed, reactive } from 'vue'

// View-only state follows an instance across reorder and responsive remounts.
// Weak character ownership releases it when the character view is closed.
const characters = new WeakMap()
export function useWeaponDisclosure(character, uid) {
  let collapsed = characters.get(character)
  if (!collapsed) { collapsed = reactive(new Set()); characters.set(character, collapsed) }
  const isCollapsed = computed(() => collapsed.has(uid()))
  function toggle() {
    const key = uid()
    if (collapsed.has(key)) collapsed.delete(key)
    else collapsed.add(key)
  }
  return { collapsed: isCollapsed, toggle }
}
