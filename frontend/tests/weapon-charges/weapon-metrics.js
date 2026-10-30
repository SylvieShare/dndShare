import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive } from 'vue'
import WeaponMetricsTable from '../../src/features/character-editor/blocks/dnd/components/WeaponMetricsTable.vue'
const data = reactive({ attack: '+7', modifier: 3,
  damageParts: [{ count: 1, diceSides: 6, type: 'Дробящий', typeColor: '#fbbf24' }],
  twoHandedParts: [{ count: 1, diceSides: 8, type: 'Дробящий', typeColor: '#fbbf24' }],
  properties: [{ id: 1, label: 'Универсальное', desc: 'Две руки' }, { id: 2, label: 'Метательное' }],
})
window.metricsData = data
window.propertyEvents = []
createApp({ render: () => h('main', { style: 'margin:20px;width:340px' }, [h(WeaponMetricsTable, {
  ...data, interactive: true,
  onPropertyEnter: (_event, property) => window.propertyEvents.push(property.label),
})]) }).mount('#app')
