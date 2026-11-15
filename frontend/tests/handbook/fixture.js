import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { clickOutside } from '../../src/shared/lib/clickOutside'
import ItemPickerModal from '../../src/features/handbook/components/ItemPickerModal.vue'

const params = new URLSearchParams(location.search)
const app = createApp({ render: () => h(ItemPickerModal, {
  itemTypeIds: [5], sourceVersionId: Number(params.get('edition')),
  contentSources: { mode: 'selected', ids: [15], allowLegacy: false },
}) })
app.use(createPinia()).use(createRouter({ history: createMemoryHistory(), routes: [
  { path: '/', component: { render: () => null } },
] })).directive('click-outside', clickOutside).mount('#app')
