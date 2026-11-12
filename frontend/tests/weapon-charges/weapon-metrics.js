import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, reactive } from 'vue'
import WeaponMetricsTable from '../../src/features/character-editor/blocks/dnd/components/WeaponMetricsTable.vue'
const data = reactive({ attack: '+7',
  damageRows: [{ source: 'Оружие', expression: '1d6{Дробящий|#fbbf24}' }, { source: 'Сила', expression: '1' }, { source: 'Ярость', expression: '2' }],
  twoHandedRows: [{ source: 'Оружие', expression: '1d8{Дробящий|#fbbf24}' }, { source: 'Сила', expression: '1' }, { source: 'Ярость', expression: '2' }],
  properties: [{ id: 1, label: 'Универсальное', desc: 'Две руки' }, { id: 2, label: 'Метательное' }],
})
window.metricsData = data
window.propertyEvents = []
window.parentClicks = 0
createApp({ render: () => h('main', { style: 'margin:20px;width:340px', onClick: () => window.parentClicks++ }, [h(WeaponMetricsTable, {
  ...data, interactive: true,
  onPropertyEnter: (_event, property) => window.propertyEvents.push(property.label),
})]) }).mount('#app')
