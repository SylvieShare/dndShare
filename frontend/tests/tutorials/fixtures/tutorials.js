import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { useAccountStore } from '../../../src/stores/account'
import { clickOutside } from '../../../src/shared/lib/clickOutside'
import AppNotifications from '../../../src/features/notifications/components/AppNotifications.vue'
import ViewCharacter from '../../../src/features/character-editor/pages/ViewCharacter.vue'
import AccountTutorials from '../../../src/features/tutorials/components/AccountTutorials.vue'
import ViewSession from '../../../src/features/sessions/pages/ViewSession.vue'
import '@sylvieshare/share-ui/styles.css'
const pinia = createPinia()
const account = useAccountStore(pinia)
const guest = new URLSearchParams(location.search).has('guest')
account.status = guest ? 'none' : 'success'
account.user = { id: guest ? 0 : 1, roles: [], login: guest ? '' : 'Игрок' }
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/char/:uuid', name: 'Character', component: ViewCharacter },
  { path: '/sessions/:uuid', name: 'Session', component: ViewSession },
  { path: '/account-tutorials', component: AccountTutorials },
  { path: '/done', component: { render: () => h('div', 'Другая страница') } },
] })
await router.push(new URLSearchParams(location.search).get('page') || '/char/test')
await router.isReady()
window.tutorialNavigateAway = () => router.push('/done')
createApp({ render: () => [h(RouterView, null, { default: ({ Component, route }) => h(Component, { key: route.path }) }), h(AppNotifications)] }).use(pinia).use(router).directive('click-outside', clickOutside).mount('#app')
