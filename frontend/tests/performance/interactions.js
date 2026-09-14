import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Fixture from './Interactions.vue'
import '@sylvieshare/share-ui/styles.css'
createApp(Fixture).use(createPinia()).mount('#app')
