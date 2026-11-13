import { createApp, h } from 'vue'
import '@sylvieshare/share-ui/styles.css'
import '@/app/theme.css'
import ErrorReporter from '@/features/error-report/components/ErrorReporter.vue'

createApp({ render: () => h('main', { style: 'padding:64px;min-height:100vh;background:var(--bg)' }, [
  h('button', { id: 'report-target', style: 'padding:30px;background:var(--surface);color:var(--text-1)' }, 'Проблемная кнопка'),
  h(ErrorReporter),
]) }).mount('#app')
