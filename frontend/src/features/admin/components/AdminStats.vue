<template>
  <div class="admin-stats">
    <div v-if="loading" class="state-msg">Загрузка...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>
    <template v-else>
      <div class="stats-grid">
        <div class="stat-card accent">
          <div class="stat-icon">👤</div>
          <div class="stat-value">{{ stats.users }}</div>
          <div class="stat-label">Пользователей</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">📜</div>
          <div class="stat-value">{{ stats.characters }}</div>
          <div class="stat-label">Персонажей</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">🗂</div>
          <div class="stat-value">{{ stats.templates }}</div>
          <div class="stat-label">Шаблонов</div>
        </div>

        <div class="stat-card">
          <div class="stat-icon">⚠️</div>
          <div class="stat-value" :class="{ 'value-warn': stats.logs > 0 }">{{ stats.logs }}</div>
          <div class="stat-label">Ошибок в логах</div>
        </div>
      </div>

      <div class="section-title">Справочник</div>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">{{ stats.baseItems }}</div>
          <div class="stat-label">Базовых предметов</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.userItems }}</div>
          <div class="stat-label">Пользовательских предметов</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.baseSuggests }}</div>
          <div class="stat-label">Базовых словарей</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.userSuggests }}</div>
          <div class="stat-label">Пользовательских словарей</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { getStats } from '../api/adminApi'

const stats = ref(null)
const loading = ref(true)
const error = ref('')

async function load() {
  loading.value = true
  error.value = ''
  try {
    stats.value = await getStats()
  } catch {
    error.value = 'Ошибка загрузки статистики'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.admin-stats {
  padding: 28px 24px;
}

.state-msg {
  color: var(--text-2);
  font-size: 14px;
  padding: 16px 0;
}

.state-msg.error {
  color: #e05c5c;
}

.section-title {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 28px 0 14px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #1e1e24;
  border: 1px solid #2a2a2e;
  border-radius: 12px;
  padding: 20px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;
}

.stat-card:hover {
  border-color: #3a3a42;
}

.stat-card.accent {
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.stat-icon {
  font-size: 22px;
  line-height: 1;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  color: var(--text-1);
  letter-spacing: -0.02em;
}

.stat-value.value-warn {
  color: #e05c5c;
}

.stat-card.accent .stat-value {
  color: #a08aff;
}

.stat-label {
  color: var(--text-2);
  font-size: 12px;
  margin-top: 2px;
}
</style>
