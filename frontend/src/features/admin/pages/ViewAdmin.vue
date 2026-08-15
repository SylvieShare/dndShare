<template>
  <div class="admin-page">
    <aside class="admin-sidebar">
      <div class="admin-sidebar-header">Администрирование</div>
      <nav class="admin-sidebar-nav" aria-label="Разделы администрирования" role="tablist">
        <button
          v-for="(tab, index) in tabs"
          :id="`admin-tab-${tab.id}`"
          :key="tab.id"
          ref="tabButtons"
          class="sidebar-tab"
          :class="{ active: activeTab === tab.id }"
          role="tab"
          :aria-controls="'admin-panel'"
          :aria-selected="activeTab === tab.id"
          :tabindex="activeTab === tab.id ? 0 : -1"
          @click="selectTab(tab.id)"
          @keydown="onTabKeydown($event, index)"
        >
          {{ tab.label }}
        </button>
      </nav>
    </aside>

    <main
      id="admin-panel"
      class="admin-content"
      role="tabpanel"
      :aria-labelledby="`admin-tab-${activeTab}`"
    >
      <AdminStats v-if="activeTab === 'stats'" />
      <AdminUsers v-else-if="activeTab === 'users'" />
      <AdminLogs v-else-if="activeTab === 'logs'" />
      <AdminErrorReports v-else-if="activeTab === 'error-reports'" />
      <AdminJobs v-else-if="activeTab === 'jobs'" />
    </main>
  </div>
</template>

<script setup>
import { computed, nextTick, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AdminJobs from '../components/AdminJobs.vue'
import AdminLogs from '../components/AdminLogs.vue'
import AdminErrorReports from '../components/AdminErrorReports.vue'
import AdminStats from '../components/AdminStats.vue'
import AdminUsers from '../components/AdminUsers.vue'

const tabs = [
  { id: 'stats', label: 'Статистика' },
  { id: 'users', label: 'Пользователи' },
  { id: 'logs', label: 'Логи' },
  { id: 'error-reports', label: 'Ошибки страниц' },
  { id: 'jobs', label: 'Задачи' },
]

const route = useRoute()
const router = useRouter()
const tabIds = new Set(tabs.map(tab => tab.id))
const tabButtons = ref([])

const activeTab = computed(() => {
  const tab = route.query.tab
  return typeof tab === 'string' && tabIds.has(tab) ? tab : 'stats'
})

function selectTab(tab) {
  const query = { ...route.query }
  if (tab === 'stats') delete query.tab
  else query.tab = tab
  router.push({ query })
}

function onTabKeydown(event, index) {
  const keyToIndex = {
    ArrowDown: (index + 1) % tabs.length,
    ArrowRight: (index + 1) % tabs.length,
    ArrowUp: (index - 1 + tabs.length) % tabs.length,
    ArrowLeft: (index - 1 + tabs.length) % tabs.length,
    Home: 0,
    End: tabs.length - 1,
  }
  const nextIndex = keyToIndex[event.key]
  if (nextIndex === undefined) return

  event.preventDefault()
  selectTab(tabs[nextIndex].id)
  nextTick(() => {
    tabButtons.value[nextIndex]?.focus()
    tabButtons.value[nextIndex]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  })
}
</script>

<style scoped>
.admin-page {
  display: flex;
  gap: 20px;
  padding: 20px;
  min-height: calc(100vh - 54px);
}

.admin-sidebar {
  width: 208px;
  flex-shrink: 0;
  align-self: flex-start;
  background: color-mix(in srgb, var(--surface-raised) 76%, var(--bg));
  border: 1px solid color-mix(in srgb, var(--text-1) 10%, transparent);
  border-radius: 14px;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--bg) 42%, transparent);
  padding: 12px 8px;
}

.admin-sidebar-header {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.09em;
  padding: 6px 12px 10px;
  text-transform: uppercase;
}

.admin-sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sidebar-tab {
  background: none;
  border: none;
  border-radius: 7px;
  color: var(--text-2);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  padding: 9px 12px 9px 14px;
  position: relative;
  text-align: left;
  width: 100%;
  transition: color 0.15s, background 0.15s, transform 0.15s;
}

.sidebar-tab:hover {
  background: var(--surface);
  color: var(--text-1);
}

.sidebar-tab.active {
  background: color-mix(in srgb, var(--accent) 17%, var(--surface));
  color: var(--text-on-accent);
  font-weight: 600;
}

.sidebar-tab.active::before {
  background: var(--accent-soft);
  border-radius: 0 3px 3px 0;
  content: '';
  height: 20px;
  left: 0;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
}

.sidebar-tab:focus-visible {
  outline: 2px solid var(--accent-soft);
  outline-offset: 2px;
}

.admin-content {
  background: color-mix(in srgb, var(--surface-raised) 44%, var(--bg));
  border: 1px solid color-mix(in srgb, var(--text-1) 8%, transparent);
  border-radius: 14px;
  box-shadow: 0 12px 28px color-mix(in srgb, var(--bg) 30%, transparent);
  flex: 1;
  min-width: 0;
}

@media (max-width: 760px) {
  .admin-page {
    display: block;
    padding: 0;
  }

  .admin-sidebar {
    background: color-mix(in srgb, var(--surface-raised) 92%, var(--bg));
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--text-1) 10%, transparent);
    border-radius: 0;
    box-shadow: 0 6px 14px color-mix(in srgb, var(--bg) 25%, transparent);
    box-sizing: border-box;
    padding: 0;
    position: sticky;
    top: 0;
    width: 100%;
    z-index: 5;
  }

  .admin-sidebar-header {
    display: none;
  }

  .admin-sidebar-nav {
    -webkit-overflow-scrolling: touch;
    flex-direction: row;
    gap: 0;
    overflow-x: auto;
    padding: 6px 8px;
    scrollbar-width: thin;
  }

  .sidebar-tab {
    flex: 0 0 auto;
    padding: 9px 12px;
    text-align: center;
    width: auto;
    white-space: nowrap;
  }

  .sidebar-tab.active::before {
    border-radius: 3px 3px 0 0;
    bottom: 0;
    height: 3px;
    left: 12px;
    top: auto;
    transform: none;
    width: calc(100% - 24px);
  }

  .admin-content {
    background: transparent;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    width: 100%;
  }
}
</style>
