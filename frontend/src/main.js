import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@sylvieshare/share-ui/styles.css'
import '@/app/theme.css'
import { clickOutside } from '@/shared/lib/clickOutside'
import { router } from '@/app/router'
import { installConsoleErrorCapture } from '@/features/console-errors/lib/consoleErrorCapture'

installConsoleErrorCapture()

createApp(App)
    .use(createPinia())
    .use(router)
    .directive('click-outside', clickOutside)
    .mount('#app')
