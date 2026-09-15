import { createApp, h } from 'vue'
import { createPinia } from 'pinia'
import { createRichNodeHtml } from '@sylvieshare/share-ui'
import PotionDetailContent from '../../../src/features/items/detail-components/PotionDetailContent.vue'
import { useDiceStore } from '../../../src/stores/dice'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

const pinia = createPinia()
window.presentationDice = useDiceStore(pinia)
const desc = `<p>Восстанавливает ${createRichNodeHtml('dice', { formula: '2к4 + 2' }, 'Лечение')}
${createRichNodeHtml('stat', { stat: 'hp' }, 'хитов')}.
Класс доспеха ${createRichNodeHtml('stat', { stat: 'ac' }, '15')}.</p>`
createApp({ render: () => h('main', { style: 'padding:24px;max-width:640px' }, [
  h(PotionDetailContent, { item: { name: 'Зелье лечения', typeId: 10, data: { desc, consumption: { healing: '2d4 + 2' } } } }),
]) }).use(pinia).mount('#app')
