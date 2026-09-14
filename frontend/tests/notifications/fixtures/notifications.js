import { createApp, h, Fragment } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory, RouterView } from 'vue-router'
import { useAccountStore } from '../../../src/stores/account'
import { clickOutside } from '../../../src/shared/lib/clickOutside'
import ViewCharacter from '../../../src/features/character-editor/pages/ViewCharacter.vue'
import AccountTutorials from '../../../src/features/tutorials/components/AccountTutorials.vue'
import ViewSession from '../../../src/features/sessions/pages/ViewSession.vue'
import '@sylvieshare/share-ui/styles.css'
import AppNotifications from '../../../src/features/notifications/components/AppNotifications.vue'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import { useDiceStore } from '../../../src/stores/dice'
import { useNotificationsStore } from '../../../src/stores/notifications'
const pinia = createPinia()
const account = useAccountStore(pinia)
account.status = 'success'
account.user = { id: 1, roles: [], login: 'Игрок' }
const router = createRouter({ history: createMemoryHistory(), routes: [
  { path: '/char/:uuid', name: 'Character', component: ViewCharacter },
  { path: '/sessions/:uuid', name: 'Session', component: ViewSession },
  { path: '/account-tutorials', component: AccountTutorials },
  { path: '/done', component: { render: () => h('div', 'Другая страница') } },
] })
await router.push(new URLSearchParams(location.search).get('page') || '/char/test')
await router.isReady()
window.tutorialNavigateAway = () => router.push('/done')
window.notificationFixture = { dice: useDiceStore(pinia), events: useSessionEventsStore(pinia), notifications: useNotificationsStore(pinia) }
createApp({ render: () => h(Fragment, [h(RouterView), h(AppNotifications)]) }).use(pinia).use(router).directive('click-outside', clickOutside).mount('#app')
