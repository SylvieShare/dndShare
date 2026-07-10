import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { clickOutside } from '@/shared/lib/clickOutside'
import { router } from '@/app/router'

createApp(App)
    .use(createPinia())
    .use(router)
    .directive('click-outside', clickOutside)
    .mount('#app')
