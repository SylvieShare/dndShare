import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import CharacterSheetModal from '../../../src/features/character-editor/components/CharacterSheetModal.vue'
import { useAccountStore } from '../../../src/stores/account'
import { useSessionEventsStore } from '../../../src/stores/sessionEvents'
import { subscribeSessionLive } from '../../../src/features/sessions/composables/sessionLiveConnection'
import { clickOutside } from '../../../src/shared/lib/clickOutside'
import { applyDocumentPatches } from '../../../src/shared/lib/documentPatch'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const params = new URLSearchParams(location.search)
const pinia = createPinia(),
  account = useAccountStore(pinia)
account.user = { id: 1, login: 'Игрок', roles: [] }
account.status = 'success'
window.savedCharacter = {
  templateName: 'DND5',
  userId: params.has('other') ? 2 : 1,
  version: 1,
  publicVisible: true,
  sourceVersionId: 1,
  sourceVersion: '2014',
  data: {
    values: {
      name: 'Торин',
      hp: { current: 10, max: { base: 10, bonuses: [] }, hitDice: [] },
    },
    var: {},
  },
}
window.characterRequests = []
window.fetch = async (url, options = {}) => {
  const path = new URL(String(url), location.origin).pathname
  if (
    path === '/api/char/sheet' &&
    (!options.method || options.method === 'GET')
  )
    return Response.json(window.savedCharacter)
  if (path === '/api/char/sheet/data' && options.method === 'PATCH') {
    const packet = JSON.parse(options.body)
    window.characterRequests.push(packet)
    window.savedCharacter.data = applyDocumentPatches(
      structuredClone(window.savedCharacter.data),
      packet.patches,
    )
    window.savedCharacter.version++
    const response = Response.json({
      version: window.savedCharacter.version,
      patches: packet.patches,
    })
    if (window.holdCharacterResponse) {
      window.holdCharacterResponse = false
      await new Promise((resolve) => {
        window.releaseCharacterResponse = resolve
      })
    }
    return response
  }
  if (path === '/api/sources')
    return Response.json({
      sources: [
        { id: 1, name: 'DND5e', versions: [{ id: 1, version: '2014' }] },
      ],
    })
  return Response.json({ items: [], events: [], sources: [] })
}
const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { render: () => null } }],
})
if (params.has('live')) {
  useSessionEventsStore(pinia).sessionUuid = 'session'
  window.EventSource = class {
    readyState = 1
    constructor() {
      window.sheetEventSource = this
    }
    addEventListener(type, listener) {
      this[type] = listener
    }
    close() {}
  }
  subscribeSessionLive('session', { status() {}, update() {} })
  window.sheetEventSource.onopen()
  window.sheetEventSource.update({
    data: JSON.stringify({
      roster: {
        sequence: 1,
        data: [
          {
            charId: 7,
            charUuid: 'sheet',
            canOpenSheet: true,
            version: 1,
            data: window.savedCharacter.data,
          },
        ],
      },
    }),
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
}
createApp({
  setup() {
    const open = ref(true)
    return () => [
      h('button', { onClick: () => (open.value = true) }, 'Открыть лист'),
      open.value
        ? h(CharacterSheetModal, {
            uuid: 'sheet',
            isDm: params.has('dm'),
            draft: params.has('preview') ? window.savedCharacter : null,
            onClose: () => (open.value = false),
          })
        : null,
    ]
  },
})
  .use(pinia)
  .use(router)
  .directive('click-outside', clickOutside)
  .mount('#app')
