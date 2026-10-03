import { createApp, h, provide, reactive, ref } from 'vue'
import { createPinia } from 'pinia'
import { BaseTile } from '@sylvieshare/share-ui'
import EncounterRowMenu from '../../../src/features/sessions/components/EncounterRowMenu.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'
const enc = reactive({
  encounter: { combatants: [{ uid: 'goblin', type: 'npc', hpCurrent: 7, impactHistory: [] }] },
  npcHpFormula: () => '', canEditPlayerHp: () => true,
  flushApplicationSave: async () => true,
  load: async () => { enc.encounter.combatants[0].impactHistory = [{ action: 'Огненный шар', createdAt: new Date().toISOString(), before: { current: 20, max: 20, temp: 2 }, after: { current: 7, max: 20, temp: 0 }, total: 15, absorbed: 2, damage: [{ applied: 15, label: 'Огонь' }], effects: [{ id: 15, name: 'Горение', duration: { kind: 'rounds', value: 2 } }] }] },
})
createApp({ setup() {
  provide('encounter', enc)
  const menu = ref(null)
  return () => h('main', { style: 'margin:20px' }, [
    h(BaseTile, { interactive: true, role: 'button', tabindex: 0, onClick: event => menu.value?.toggle(event.currentTarget) }, () => 'Гоблин Б'),
    h(EncounterRowMenu, { ref: menu, combatant: enc.encounter.combatants[0], section: 'combat' }),
  ])
} }).use(createPinia()).mount('#app')
