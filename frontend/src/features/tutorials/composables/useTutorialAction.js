import { inject, onBeforeUnmount, onMounted } from 'vue'
import { tutorialActionsKey } from '../lib/targets'
export function useTutorialAction(name, action) {
  const actions = inject(tutorialActionsKey, null)
  let unregister = null
  onMounted(() => { unregister = actions?.register(name, action) })
  onBeforeUnmount(() => unregister?.())
}
