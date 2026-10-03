import { createApp, h, reactive } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import TemplateBlockInner from '../../../src/features/character-editor/components/TemplateBlockInner.vue'
import schema from '../../../src/features/character-editor/settings/dnd/schema'
import { blankValues } from '../../../src/features/character-editor/settings/dnd/newCharacter'
import { layoutNodeToBlock } from '../../../src/features/character-editor/lib/templateSchema'
import { useDiceStore } from '../../../src/stores/dice'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
const ownerMode = !new URLSearchParams(location.search).has('readonly')
const values = reactive(blankValues())
const ctx = reactive({ ownerMode, canEdit: ownerMode, rulesVersion: '2014', values })
const grid = schema.layouts.desktop.tabs[0].content.children[2].children[1]
window.rolls = []
window.writes = []
const dice = useDiceStore(pinia)
dice.rollD20 = (...args) => window.rolls.push({ kind: 'd20', args })
dice.roll = (...args) => window.rolls.push({ kind: 'roll', args })
const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => null } }] })
createApp({ render: () => h('main', { style: 'margin:24px' }, [h(TemplateBlockInner, {
  block: layoutNodeToBlock(grid, schema), values, vars: {},
  'onUpdate:value': patch => window.writes.push(patch),
})]) }).use(pinia).use(router).provide('charCtx', ctx).mount('#app')
