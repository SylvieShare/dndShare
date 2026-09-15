import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { RowActionMenu } from '@sylvieshare/share-ui'
import SessionSettingsWorkspace from '../../../src/features/sessions/components/SessionSettingsWorkspace.vue'
import ItemTransferAction from '../../../src/features/character-editor/components/ItemTransferAction.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const settings = reactive({ players: {}, combat: {}, interactions: { items: true, potions: true, spells: true }, autoAccept: { items: false, potions: false, spells: false } })
const ctx = reactive({ ownerMode: true, topSession: { uuid: 'session' }, itemTransfers: { state: { settings, busy: false, loading: false }, recipients: [], loadPlayers() {} } })
createApp({ render: () => h('main', { style: 'padding:16px;max-width:700px' }, [
  h(SessionSettingsWorkspace, { settings, 'onUpdate-setting': (key, value) => { const [section, field] = key.split('.'); settings[section][field] = value } }),
  h(RowActionMenu, null, { trigger: () => h('button', 'Зелье'), default: () => [
    h(ItemTransferAction, { purpose: 'transfer', source: 'potions', entry: { uid: 'dose' } }),
    h(ItemTransferAction, { purpose: 'use', source: 'potions', entry: { uid: 'dose' } }),
  ] }),
]) }).use(createPinia()).provide('charCtx', ctx).mount('#app')
