import '@sylvieshare/share-ui/styles.css'
import '../../src/app/theme.css'
import { createApp, h, ref } from 'vue'
import { createPinia } from 'pinia'
import DndCreateWizard from '../../src/features/character-list/components/wizard/DndCreateWizard.vue'
const wizard = ref(null)
createApp({ setup: () => () => h(DndCreateWizard, {
  ref: wizard, templateId: 1, templateName: 'DND5', sourceVersionId: 7, rulesVersion: '2014',
  onCreate(payload) { window.created = payload; wizard.value.clearDraft() },
}) }).use(createPinia()).mount('#app')
