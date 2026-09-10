import { inject } from 'vue'
export const SESSION_ENTITY_FORM = Symbol('sessionEntityForm')
export function useSessionEntityForm() {
  return inject(SESSION_ENTITY_FORM)
}
