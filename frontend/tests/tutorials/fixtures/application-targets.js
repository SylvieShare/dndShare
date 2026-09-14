import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { useAccountStore } from '../../../src/stores/account'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import SessionTransferApproval from '../../../src/features/sessions/components/SessionTransferApproval.vue'
import ItemTransferAction from '../../../src/features/character-editor/components/ItemTransferAction.vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const pinia = createPinia()
useAccountStore(pinia).user = { id: 1 }
const events = useSessionEventsStore(pinia)
events.sessionUuid = 'campaign'
events.refresh = async () => {}
const event = reactive({ id: 1, sessionOwnerUserId: 1, data: { purpose: 'use', status: 'pending', addressedToDm: true } })
const ctx = { ownerMode: true, topSession: {}, itemTransfers: { state: { busy: false }, recipients: [], loadPlayers() {}, send: async (...args) => { window.sent = args; return true } } }
createApp({ render: () => h('main', { style: 'padding:24px' }, [
  h(SessionTransferApproval, { event }),
  h(RowActionMenu, { title: 'Заклинание' }, { trigger: () => h('button', 'Заклинание'), default: () => h(ItemTransferAction, { source: 'spells', purpose: 'use', entry: { uid: '990' }, optionKey: 'haste', name: 'Ускорение' }) }),
]) }).use(pinia).provide('charCtx', ctx).mount('#app')
