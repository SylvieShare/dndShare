<template>
  <teleport v-if="canInspect && entries.length" to="body">
    <aside
      class="console-error-inbox"
      :class="{ expanded }"
      data-error-report-ignore
    >
      <button
        class="console-error-trigger"
        type="button"
        aria-controls="console-error-list"
        :aria-expanded="expanded"
        :aria-hidden="expanded"
        :tabindex="expanded ? -1 : 0"
        :aria-label="`Ошибки JavaScript: ${totalCount}`"
        @click="expanded = true"
      >{{ triggerLabel }}</button>

      <section
        id="console-error-list"
        class="console-error-panel"
        :aria-hidden="!expanded"
        :inert="!expanded"
      >
        <header class="console-error-head">
          <div>
            <strong>Ошибки JavaScript</strong>
            <span>{{ totalCount }} за эту загрузку страницы</span>
          </div>
          <button type="button" aria-label="Свернуть список ошибок" @click="expanded = false">×</button>
        </header>

        <div class="console-error-list">
          <button
            v-for="entry in entries"
            :key="entry.id"
            class="console-error-row"
            type="button"
            @click="activeErrorId = entry.id"
          >
            <span class="console-error-row-head">
              <strong>{{ sourceLabel(entry.source) }}</strong>
              <time>{{ formatTime(entry.updatedAt) }}</time>
            </span>
            <span class="console-error-message">{{ entry.message }}</span>
            <span class="console-error-row-meta">
              <code>{{ pagePath(entry.pageUrl) }}</code>
              <em v-if="entry.count > 1">×{{ entry.count }}</em>
            </span>
          </button>
        </div>
      </section>
    </aside>
  </teleport>

  <AppModal v-if="activeError" :z-index="9800" extra-wide @close="activeErrorId = null">
    <article class="console-error-detail" data-error-report-ignore>
      <header>
        <div>
          <span>{{ sourceLabel(activeError.source) }}</span>
          <h2>{{ activeError.message }}</h2>
        </div>
        <strong v-if="activeError.count > 1">Повторилась {{ activeError.count }} раз</strong>
      </header>

      <dl>
        <div><dt>Страница</dt><dd><code>{{ activeError.pageUrl || '—' }}</code></dd></div>
        <div><dt>Время</dt><dd>{{ formatFullTime(activeError.updatedAt) }}</dd></div>
      </dl>

      <section>
        <span>Полный текст</span>
        <pre>{{ activeError.detail }}</pre>
      </section>
    </article>
  </AppModal>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppModal from '@/shared/ui/AppModal.vue'
import { useAccountStore } from '@/stores/account'
import { subscribeConsoleErrors } from '../lib/consoleErrorCapture'

const accountStore = useAccountStore()
const entries = ref([])
const totalCount = ref(0)
const expanded = ref(false)
const activeErrorId = ref(null)

let unsubscribe = null

const canInspect = computed(() => {
  const roles = accountStore.user?.roles || []
  return roles.includes('ERROR_REPORT_REVIEWER') || roles.includes('ADMIN')
})
const triggerLabel = computed(() => totalCount.value > 1
  ? (totalCount.value > 99 ? '99+' : String(totalCount.value))
  : '!')
const activeError = computed(() => entries.value.find(entry => entry.id === activeErrorId.value) || null)

watch(canInspect, allowed => {
  if (allowed) return
  expanded.value = false
  activeErrorId.value = null
})

onMounted(() => {
  unsubscribe = subscribeConsoleErrors(snapshot => {
    entries.value = snapshot.entries
    totalCount.value = snapshot.totalCount
    if (activeErrorId.value && !activeError.value) activeErrorId.value = null
  })
})

onBeforeUnmount(() => unsubscribe?.())

function sourceLabel(source) {
  if (source === 'console.error') return 'Console error'
  if (source === 'unhandledrejection') return 'Promise rejection'
  return 'Runtime error'
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatFullTime(value) {
  return new Date(value).toLocaleString('ru-RU')
}

function pagePath(value) {
  try {
    const url = new URL(value)
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value || '—'
  }
}
</script>

<style scoped src="./styles/ConsoleErrorInbox.css"></style>
