import { createApp, h, ref } from 'vue'
import PersonaMediaPicker from '../../../src/features/character-list/components/wizard/PersonaMediaPicker.vue'
import '@sylvieshare/share-ui/styles.css'
import '../../../src/app/theme.css'

createApp({ setup() {
  const portrait = ref(null), icon = ref(null)
  return () => h('main', { style: 'max-width:400px;padding:16px' }, [h(PersonaMediaPicker, {
    portrait: portrait.value, icon: icon.value,
    'onUpdate:portrait': value => { portrait.value = value },
    'onUpdate:icon': value => { icon.value = value },
  })])
} }).mount('#app')
