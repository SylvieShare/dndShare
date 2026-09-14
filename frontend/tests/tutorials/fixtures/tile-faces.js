import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
import DndActionsView from '../../../src/features/character-editor/blocks/dnd/components/DndActionsView.vue'
import DndDefensesView from '../../../src/features/character-editor/blocks/dnd/components/DndDefensesView.vue'
import BlockResourcesView from '../../../src/features/character-editor/blocks/generic/components/BlockResourcesView.vue'
import BlockTagsView from '../../../src/features/character-editor/blocks/generic/components/BlockTagsView.vue'
import BlockMoneyView from '../../../src/features/character-editor/blocks/generic/components/BlockMoneyView.vue'
import BlockStatesSummaryView from '../../../src/features/character-editor/blocks/generic/components/BlockStatesSummaryView.vue'
import DndExhaustionView from '../../../src/features/character-editor/blocks/dnd/components/DndExhaustionView.vue'
import DndCounterTileView from '../../../src/features/character-editor/blocks/dnd/components/DndCounterTileView.vue'
import DndQuestCard from '../../../src/features/character-editor/blocks/dnd/components/DndQuestCard.vue'
import DndStatView from '../../../src/features/character-editor/blocks/dnd/components/DndStatView.vue'
import StatTileFace from '../../../src/features/character-editor/blocks/dnd/components/StatTileFace.vue'
import DndHpView from '../../../src/features/character-editor/blocks/dnd/components/DndHpView.vue'
import DndLvlView from '../../../src/features/character-editor/blocks/dnd/components/DndLvlView.vue'
const faces = [
  { name: 'DndActionsView', component: DndActionsView, props: {"groups": []} },
  { name: 'DndDefensesView', component: DndDefensesView, props: {} },
  { name: 'BlockResourcesView', component: BlockResourcesView, props: {} },
  { name: 'BlockTagsView', component: BlockTagsView, props: {} },
  { name: 'BlockMoneyView', component: BlockMoneyView, props: {"coins": [{"id": 1, "amount": 10, "title": "Золото"}]} },
  { name: 'BlockStatesSummaryView', component: BlockStatesSummaryView, props: {} },
  { name: 'DndExhaustionView', component: DndExhaustionView, props: {"level": 1} },
  { name: 'DndCounterTileView', component: DndCounterTileView, props: {"counter": {"name": "Счётчик", "value": 1, "max": 3}} },
  { name: 'DndQuestCard', component: DndQuestCard, props: {"quest": {"title": "Задание", "status": "active"}} },
  { name: 'DndStatView', component: DndStatView, props: {"title": "Сила", "mod": 2, "raw": 14} },
  { name: 'StatTileFace', component: StatTileFace, props: {"label": "Инициатива", "value": 1} },
  { name: 'DndHpView', component: DndHpView, props: {"hp": {"max": {"base": 10}, "current": 10}} },
  { name: 'DndLvlView', component: DndLvlView, props: {"data": {"level": 1, "exp": 0}} }
]
createApp({ render: () => h('main', { style: 'display:grid;gap:16px;max-width:320px;margin:16px' }, faces.flatMap(face => [false, true].map(panel => h(face.component, {
  ...face.props, panel, ...(face.name === 'DndStatView' ? { mode: panel ? 'panel' : 'tile' } : {}),
  'data-testid': `${face.name}-${panel ? 'preview' : 'source'}`,
})))) }).use(createPinia()).mount('#app')
