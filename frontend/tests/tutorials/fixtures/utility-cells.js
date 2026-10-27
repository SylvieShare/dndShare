import { createApp, h, reactive, computed, ref } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import DndUtilities from '../../../src/features/character-editor/components/sheet/DndUtilities.vue'
import '../../../src/features/character-editor/components/sheet/sheetLayout.css'
import schema from '../../../src/features/character-editor/settings/dnd/definition'
import { blankValues } from '../../../src/features/character-editor/settings/dnd/newCharacter'
import { characterSheetContext } from '../../../src/features/character-editor/lib/sheetContext'
import { useDiceStore } from '../../../src/stores/dice'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
const ownerMode = !new URLSearchParams(location.search).has('readonly')
const values = reactive(blankValues())
const ctx = reactive({ ownerMode, canEdit: ownerMode, rulesVersion: '2014', values })
window.rolls = []
window.writes = []
const dice = useDiceStore(pinia)
dice.rollD20 = (...args) => window.rolls.push({ kind: 'd20', args })
dice.roll = (...args) => window.rolls.push({ kind: 'roll', args })
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
createApp({ render: () => h('main', { class: 'character-sheet', style: 'margin:24px; width:320px' }, [h(DndUtilities)]) })
  .use(pinia).use(router).provide('charCtx', ctx).provide(characterSheetContext, {
    definition: ref(schema), values: computed(() => values), vars: ref({}),
    updateValue: patch => window.writes.push(patch), updateVar: () => {},
  }).mount('#app')
