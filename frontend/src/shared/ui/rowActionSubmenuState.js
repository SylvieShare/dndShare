import { shallowRef } from 'vue'

export const openRowActionSubmenuId = shallowRef(null)

export function closeOpenRowActionSubmenu() {
  if (openRowActionSubmenuId.value == null) return false
  openRowActionSubmenuId.value = null
  return true
}
