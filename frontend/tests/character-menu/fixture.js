import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive, ref, provide } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createMemoryHistory } from 'vue-router'
import { useGameContextStore } from '../../src/stores/gameContext'
import { useCharacterEdition } from '../../src/features/character-editor/composables/useCharacterEdition'
import SettingsMenuTile from '../../src/features/character-editor/blocks/generic/SettingsMenuTile.vue'
import CharEditorToolbar from '../../src/features/character-editor/components/CharEditorToolbar.vue'
import CharacterEditionDialog from '../../src/features/character-editor/components/CharacterEditionDialog.vue'

const params = new URLSearchParams(location.search)
const pinia = createPinia()
const catalogue = useGameContextStore(pinia)
catalogue.ready = true
catalogue.sourceVersionId = 30
catalogue.sources = [{ id: 1, name: 'DND5e', versions: [{ id: 10, version: '2014' }, { id: 20, version: '2024' }] }, { id: 2, name: 'Vampire: TM', versions: [{ id: 30, version: '20' }] }]
const app = createApp({ setup() {
  const sourceVersionId = ref(params.has('single') ? 30 : 10), version = ref(5), isOwner = ref(!params.has('readonly'))
  const edition = useCharacterEdition({ uuid: 'fixture', isOwner, sourceVersionId, version,
    flushSave: async () => { window.flushed = true; return !params.has('saveError') },
    applyCharacter: result => { version.value = result.version; sourceVersionId.value = result.sourceVersionId },
  })
  provide('charCtx', reactive({ edition, sourceVersionId, canEdit: isOwner, canTogglePublic: isOwner, publicVisible: false, contentSources: null }))
  return () => h('main', [
    params.has('mobile') ? h(CharEditorToolbar, { canEdit: isOwner.value, sourceVersionId: sourceVersionId.value })
      : h('div', { style: 'position:fixed;right:0;top:40%;width:72px;height:70px' }, [h(SettingsMenuTile)]),
    h(CharacterEditionDialog, { controller: edition }),
    h('output', { 'data-testid': 'edition' }, String(sourceVersionId.value)),
    h('output', { 'data-testid': 'global' }, String(catalogue.sourceVersionId)),
  ])
} })
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
app.use(pinia).use(router).mount('#app')
