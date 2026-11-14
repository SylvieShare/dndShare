import { computed, provide, shallowReactive, shallowRef, ref, watch } from 'vue'
import { Users } from '@lucide/vue'
import { layoutTokens } from '@/app/design-tokens'
import { workspaceSidebarContext } from '@/shared/lib/workspaceSidebarContext'

export function useSessionSidebar(activeView) {
  const clients = shallowReactive(new Map())
  const selected = ref('players'), target = shallowRef(null), sidebar = shallowRef(null)
  const width = ref(layoutTokens['map-sidebar']), rail = ref(layoutTokens['map-rail'])
  const key = (scope, tab) => `${scope}:${tab}`
  const tabs = computed(() => [
    { key: 'players', label: 'Игроки', icon: Users },
    ...(clients.get(activeView.value)?.tabs() || []).map(tab => ({ ...tab, key: key(activeView.value, tab.key) })),
  ])
  function select(scope, tab) { sidebar.value?.openTab(key(scope, tab)) }
  function resize(size, navigation) {
    width.value = size
    if (navigation > 0) rail.value = navigation
    clients.get(activeView.value)?.resize(size, rail.value)
  }
  watch([activeView, tabs], () => {
    if (!tabs.value.some(tab => tab.key === selected.value)) selected.value = 'players'
    clients.get(activeView.value)?.resize(width.value, rail.value)
  }, { flush: 'post' })
  const context = {
    activeView, selected, target, width, rail,
    register(scope, client) {
      clients.set(scope, client)
      return () => { if (clients.get(scope) === client) clients.delete(scope) }
    },
    select, collapse: () => sidebar.value?.collapse(), bounds: () => sidebar.value?.bounds(),
  }
  provide(workspaceSidebarContext, context)
  return { selected, target, sidebar, width, rail, tabs, resize }
}
