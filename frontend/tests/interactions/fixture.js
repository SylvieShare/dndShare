import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import { useAccountStore } from '../../src/stores/account'
import { useTemplateStore } from '../../src/stores/template'
import { useCharacterInteractions } from '../../src/features/character-editor/composables/useCharacterInteractions'
import CharacterTransferDialogs from '../../src/features/character-editor/components/CharacterTransferDialogs.vue'
import { useSessionEventsStore } from '../../src/stores/sessionEvents'

const own = new URLSearchParams(location.search).get('own') || 'a'
const other = own === 'a' ? 'b' : 'a'
const names = { a: 'Лиора', b: 'Торин' }
const session = ref({ uuid: 'game' })
const app = createApp({ setup() {
  useAccountStore().user = { id: own === 'a' ? 1 : 2 }
  useTemplateStore().templates = [{ id: 1, sourceId: 1, sourceVersionId: 1, name: 'DND5' }]
  const controller = reactive({ state: { view: '', busy: false, loading: false, transfers: [], participants: [] },
    recipients: [{ charUuid: other, templateId: 1, data: { values: { name: names[other] } } }],
    anchor: null, close() { this.state.view = '' },
  })
  controller.interactions = useCharacterInteractions({ uuid: own, session, isOwner: ref(true), closePopover: () => controller.close() })
  window.fixture = { controller, session, refresh: () => controller.interactions.refresh() }
  useSessionEventsStore().setContext({ uuid: 'game' })
  controller.interactions.refresh()
  return () => h('main', { style: 'padding:30px' }, [
    h('button', { onClick: e => { controller.anchor = e.currentTarget; controller.state.view = 'players' } }, 'Игроки'),
    h('button', { onClick: e => { controller.anchor = e.currentTarget; controller.state.view = 'events' } }, `События: ${controller.interactions.state.pending.length}`),
    h(CharacterTransferDialogs, { controller, characterUuid: own }),
  ])
} })
app.use(createPinia())
app.mount('#app')
