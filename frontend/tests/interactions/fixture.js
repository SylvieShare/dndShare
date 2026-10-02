import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref, provide, computed } from 'vue'
import { createPinia } from 'pinia'
import { useAccountStore } from '../../src/stores/account'
import { useTemplateStore } from '../../src/stores/template'
import { useCharacterMoneyTransfer } from '../../src/features/character-editor/composables/useCharacterMoneyTransfer'
import { useCharacterInteractions } from '../../src/features/character-editor/composables/useCharacterInteractions'
import CharacterTransferDialogs from '../../src/features/character-editor/components/CharacterTransferDialogs.vue'
import { useSessionEventsStore } from '../../src/stores/sessionEvents'

import CampaignBadge from '../../src/features/character-editor/blocks/generic/CampaignBadge.vue'
import { createRouter, createMemoryHistory } from 'vue-router'

const own = new URLSearchParams(location.search).get('own') || 'a'
const other = own === 'a' ? 'b' : 'a'
const names = { a: 'Лиора', b: 'Торин' }
const session = ref({ uuid: 'game' })
const app = createApp({ setup() {
  useAccountStore().user = { id: own === 'a' ? 1 : 2 }
  useTemplateStore().templates = [{ id: 1, sourceId: 1, sourceVersionId: 1, name: 'DND5' }]
  const controller = reactive({ state: { view: '', busy: false, loading: false, transfers: [], participants: [], playersLoaded: true },
    recipients: [{ charUuid: other, templateId: 1, data: { values: { name: names[other] } } }],
    anchor: null, registerAnchor() {}, unregisterAnchor() {}, open(view, anchor) { this.anchor = anchor; this.state.view = view }, close() { this.state.view = '' },
  })
  const data = ref({ values: { money: { amounts: { 1: 20 } } } }), version = ref(3)
  controller.recipients[0].iconImageUrl = '/brand-mark.webp'
  Object.assign(controller.recipients[0].data.values, { race: { name: 'Дварф' }, classes: [{ name: 'Воин' }], hp: { current: 24, max: { base: 40 }, temp: 3 } })
  controller.money = useCharacterMoneyTransfer({ uuid: own, data, session, version, isOwner: ref(true),
    recipients: computed(() => controller.recipients), transferState: controller.state, closePopover: () => controller.close(),
    mutate: async action => {
      if (controller.state.busy) return false
      controller.state.busy = true
      try {
        version.value = 4
        const response = await action()
        data.value.values.money.amounts[1] -= response.event.data.amount
        return true
      } catch (error) { controller.state.error = error.message; return false }
      finally { controller.state.busy = false }
    },
  })
  controller.interactions = useCharacterInteractions({ uuid: own, session, isOwner: ref(true), closePopover: () => controller.close() })
  controller.incomingCount = computed(() => controller.interactions.incomingCount)
  provide('charCtx', { topSession: { uuid: 'game', name: 'Приключение' }, itemTransfers: controller })
  window.fixture = { controller, session, data, refresh: () => controller.interactions.refresh() }
  useSessionEventsStore().setContext({ uuid: 'game' })
  controller.interactions.refresh()
  return () => h('main', { style: 'padding:30px' }, [
    h(CampaignBadge),
    h(CharacterTransferDialogs, { controller, characterUuid: own }),
  ])
} })
app.use(createPinia())
app.use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] }))
app.mount('#app')
