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

        <div class="stat-card">
          <div class="stat-icon">🎯</div>
          <div class="stat-value" :class="{ 'value-warn': stats.errorReports > 0 }">{{ stats.errorReports }}</div>
          <div class="stat-label">Заявок со страниц</div>
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

      <div class="section-title storage-section-title">Хранилище</div>
      <section class="storage-card" aria-label="Статистика файлового хранилища">
        <SegmentDonutChart
          :segments="storageSegments"
          total-label="учтено"
          aria-label="Распределение занятого пространства по типам файлов"
          :format-value="formatBytes"
          :size="220"
        />

        <div class="storage-summary">
          <div class="storage-fact">
            <span>Общий объём</span>
            <strong>{{ formatBytes(storage.usedBytes) }}</strong>
          </div>
          <div class="storage-fact">
            <span>Всего объектов</span>
            <strong>{{ storage.fileCount }}</strong>
          </div>
          <p v-if="storage.unknownFileCount" class="storage-warning">
            Размер {{ storage.unknownFileCount }} {{ fileWord(storage.unknownFileCount) }} неизвестен и не включён в объём.
          </p>
          <p v-else class="storage-note">Размер известен для всех учтённых объектов.</p>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { SegmentDonutChart } from '@sylvieshare/share-ui'
import { formatBytes } from '@/shared/lib/storageUsage'
import { getStats } from '../api/adminApi'

const EMPTY_STORAGE = Object.freeze({
  usedBytes: 0,
  fileCount: 0,
  unknownFileCount: 0,
  breakdown: [],
})
const STORAGE_COLORS = Object.freeze({
  systemImages: 'var(--accent)',
  userImages: 'var(--info)',
  video: 'var(--warning)',
  systemMusic: 'var(--success)',
  userMusic: 'var(--danger)',
  svg: 'var(--accent-soft)',
})

const stats = ref(null)
const loading = ref(true)
const error = ref('')
const storage = computed(() => stats.value?.storage || EMPTY_STORAGE)
const storageSegments = computed(() => storage.value.breakdown.map(category => ({
  key: category.key,
  label: `${category.label} · ${category.fileCount}`,
  value: category.bytes,
  color: STORAGE_COLORS[category.key] || 'var(--text-muted)',
})))

function fileWord(count) {
  const mod10 = count % 10
  const mod100 = count % 100
  return mod10 === 1 && mod100 !== 11 ? 'объекта' : 'объектов'
}

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
  color: var(--danger);
}

.section-title {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 28px 0 14px;
}

.storage-section-title {
  margin-top: 32px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
}

.stat-card {
  background: var(--popover-bg);
  border: 1px solid var(--surface-raised);
  border-radius: 12px;
  padding: 20px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: border-color 0.15s;
}

.stat-card:hover {
  border-color: var(--surface-active);
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
  color: var(--danger);
}

.stat-card.accent .stat-value {
  color: var(--accent-soft);
}

.stat-label {
  color: var(--text-2);
  font-size: 12px;
  margin-top: 2px;
}

.storage-card {
  display: grid;
  grid-template-columns: minmax(420px, 1fr) minmax(210px, 280px);
  align-items: center;
  gap: 30px;
  padding: 24px;
  border: 1px solid var(--surface-raised);
  border-radius: 14px;
  background: var(--popover-bg);
}

.storage-card :deep(.segment-donut) {
  justify-content: flex-start;
}

.storage-card :deep(.segment-donut__legend) {
  min-width: min(310px, 42vw);
}

.storage-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 9px;
}

.storage-fact {
  min-width: 0;
  padding: 13px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: color-mix(in srgb, var(--surface-raised) 52%, transparent);
}

.storage-fact span {
  display: block;
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.storage-fact strong {
  color: var(--text-1);
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.storage-warning,
.storage-note {
  grid-column: 1 / -1;
  margin: 3px 0 0;
  color: var(--text-muted);
  font-size: 10px;
  line-height: 1.45;
}

.storage-warning {
  color: var(--warning);
}

@media (max-width: 980px) {
  .storage-card {
    grid-template-columns: 1fr;
  }

  .storage-summary {
    max-width: 420px;
  }
}

@media (max-width: 560px) {
  .admin-stats {
    padding: 22px 14px 32px;
  }

  .storage-card {
    gap: 22px;
    padding: 18px 14px;
  }

  .storage-card :deep(.segment-donut__legend) {
    min-width: 0;
  }

  .storage-summary {
    grid-template-columns: 1fr;
  }

  .storage-warning,
  .storage-note {
    grid-column: auto;
  }
}
</style>
