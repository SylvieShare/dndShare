import { createApp, h, provide, reactive } from 'vue'
import { createPinia } from 'pinia'
import { createDndWizardState } from '../../src/features/character-list/composables/dndCreateWizardState.js'
import StepPersona from '../../src/features/character-list/components/wizard/steps/StepPersona.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'

const state = reactive(createDndWizardState())
state.name = 'Лира'
window.personaAlignment = () => state.persona.alignment
createApp({
  setup() {
    provide('createWizard', { state, randomName() {} })
    return () => h(StepPersona)
  },
}).use(createPinia()).mount('#app')
