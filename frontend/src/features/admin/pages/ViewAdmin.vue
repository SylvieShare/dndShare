<template>
  <div class="admin-page">
    <aside class="admin-sidebar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        class="sidebar-tab"
        :class="{ active: activeTab === tab.id }"
        @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </aside>

    <main class="admin-content">
      <AdminStats v-if="activeTab === 'stats'" />
      <AdminUsers v-else-if="activeTab === 'users'" />
      <AdminLogs v-else-if="activeTab === 'logs'" />
      <AdminErrorReports v-else-if="activeTab === 'error-reports'" />
      <AdminJobs v-else-if="activeTab === 'jobs'" />
    </main>
  </div>
</template>

<script setup>
import { computed } from 'vue'
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
</script>

<style scoped>
.admin-page {
  display: flex;
  min-height: calc(100vh - 54px);
}

.admin-sidebar {
  width: 180px;
  flex-shrink: 0;
  border-right: 1px solid #2a2a2e;
  padding: 16px 8px;
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
  padding: 8px 12px;
  text-align: left;
  width: 100%;
  transition: color 0.15s, background 0.15s;
}

.sidebar-tab:hover {
  background: #222226;
  color: var(--text-1);
}

.sidebar-tab.active {
  background: #222226;
  color: #fff;
  font-weight: 600;
}

.admin-content {
  flex: 1;
  min-width: 0;
}
</style>
