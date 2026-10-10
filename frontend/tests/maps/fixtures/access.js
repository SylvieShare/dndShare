import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { useAccountStore } from '../../../src/stores/account'
import { clickOutside } from '../../../src/shared/lib/clickOutside'
import DesktopSidebar from '../../../src/shared/ui/DesktopSidebar.vue'
import AppHeader from '../../../src/shared/ui/AppHeader.vue'
import ChapterGraphToolbar from '../../../src/features/sessions/components/ChapterGraphToolbar.vue'
import ViewMaps from '../../../src/features/maps/pages/ViewMaps.vue'
import ViewMapEditor from '../../../src/features/maps/pages/ViewMapEditor.vue'
import { newMap } from '../../../src/features/maps/lib/mapModel'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const params = new URLSearchParams(location.search)
const pinia = createPinia()
const account = useAccountStore(pinia)
account.status = params.has('anonymous') ? 'none' : 'success'
account.user = { id: params.has('anonymous') ? 0 : 1, login: 'tester', roles: params.has('admin') ? ['ADMIN'] : [], hasCharacters: false }
window.mapReads = 0
window.selectedView = ''
window.fetch = async (url) => {
  if (url === '/api/maps') window.mapReads++
  const data = url === '/api/maps' && params.has('editor') ? [{ ...newMap(), id: 'private-map', name: 'Личная карта' }] : []
  return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } })
}
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/', component: { render: () => null } },
  { path: '/maps', name: 'Maps', component: ViewMaps },
  { path: '/maps/editor', name: 'MapEditor', component: ViewMapEditor },
  { path: '/:pathMatch(.*)*', component: { render: () => null } },
] })
await router.push(params.has('editor') ? '/maps/editor?id=private-map' : params.has('direct') ? '/maps' : '/')
createApp({ render: () => params.has('direct') || params.has('editor') ? h(RouterView) : h('div', [
  params.has('mobile') ? h(AppHeader) : h(DesktopSidebar),
  h('main', { style: 'margin:100px 10px 0 245px' }, [h(ChapterGraphToolbar, {
    isDm: !params.has('player'), onSelectView: view => { window.selectedView = view },
  })]),
]) }).use(pinia).use(router).directive('click-outside', clickOutside).mount('#app')
