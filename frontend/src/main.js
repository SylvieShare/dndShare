import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import '@sylvieshare/share-ui/styles.css'
import '@/app/fonts.css'
import '@/app/theme.css'
import { clickOutside } from '@/shared/lib/clickOutside'
import { router } from '@/app/router'
import { initializeLocalPlatform } from '@/platform/offline'
import { installAndroidLifecycle } from '@/platform/lifecycle'
import { initializeUpdates } from '@/platform/updates'
import { installConsoleErrorCapture } from '@/features/console-errors/lib/consoleErrorCapture'

installConsoleErrorCapture()

async function start() {
    await initializeLocalPlatform()
    installAndroidLifecycle(router)
    createApp(App)
    .use(createPinia())
    .use(router)
    .directive('click-outside', clickOutside)
    .mount('#app')
    await router.isReady()
    await initializeUpdates(router)
}
start().catch(error => {
    const root = document.getElementById('app')
    root.replaceChildren()
    const message = document.createElement('p')
    message.textContent = 'Не удалось запустить приложение: ' + error.message
    const retry = document.createElement('button')
    retry.textContent = 'Повторить'
    retry.onclick = () => location.reload()
    root.append(message, retry)
})
