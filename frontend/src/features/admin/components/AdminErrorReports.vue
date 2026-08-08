<template>
  <div class="admin-reports">
    <div class="reports-toolbar">
      <div>
        <h1>Ошибки на страницах</h1>
        <p>Заявки, отправленные через выбор проблемного элемента.</p>
      </div>
      <button class="refresh-button" type="button" :disabled="loading" @click="load">
        {{ loading ? 'Загрузка…' : 'Обновить' }}
      </button>
    </div>

    <div v-if="error" class="state-msg error">{{ error }}</div>
    <div v-if="loading && !reports.length" class="state-msg">Загрузка...</div>
    <div v-else-if="!reports.length && !error" class="state-msg">Заявок нет</div>
    <div v-else-if="reports.length" class="reports-list">
      <article v-for="report in reports" :key="report.id" class="report-card">
        <div class="report-head">
          <div class="report-identity">
            <span class="report-id">#{{ report.id }}</span>
            <span class="report-time">{{ formatTime(report.createdAt) }}</span>
            <span class="report-user">{{ report.userLogin || 'Гость' }}</span>
          </div>
          <button
            class="delete-button"
            type="button"
            :disabled="deletingIds.has(report.id)"
            @click="onDelete(report)"
          >
            {{ deletingIds.has(report.id) ? 'Удаление…' : 'Удалить' }}
          </button>
        </div>

        <div class="report-description">{{ report.description }}</div>

        <dl class="report-meta">
          <div>
            <dt>Страница</dt>
            <dd><code>{{ report.pageUrl }}</code></dd>
          </div>
          <div>
            <dt>Элемент</dt>
            <dd>
              <code>{{ report.element?.selector || '—' }}</code>
              <span v-if="report.element?.text" class="element-text">{{ report.element.text }}</span>
            </dd>
          </div>
        </dl>

        <details class="element-details">
          <summary>Все данные элемента</summary>
          <pre>{{ formatElement(report.element) }}</pre>
        </details>
      </article>
    </div>
  </div>
</template>

<script setup>
import { onMounted, reactive, ref } from 'vue'
import { deleteErrorReport, getErrorReports } from '../api/adminApi'

const reports = ref([])
const loading = ref(true)
const error = ref('')
const deletingIds = reactive(new Set())

async function load() {
  loading.value = true
  error.value = ''
  try {
    const response = await getErrorReports()
    reports.value = response.reports || []
  } catch {
    error.value = 'Ошибка загрузки заявок'
  } finally {
    loading.value = false
  }
}

async function onDelete(report) {
  if (!confirm(`Удалить заявку #${report.id}?`)) return
  deletingIds.add(report.id)
  try {
    const response = await deleteErrorReport(report.id)
    if (!response.ok) throw new Error(String(response.status))
    reports.value = reports.value.filter(item => item.id !== report.id)
  } catch {
    error.value = `Не удалось удалить заявку #${report.id}`
  } finally {
    deletingIds.delete(report.id)
  }
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function formatElement(element) {
  return JSON.stringify(element || {}, null, 2)
}

onMounted(load)
</script>

<style scoped>
.admin-reports {
  padding: 24px;
}

.reports-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 20px;
}

.reports-toolbar h1 {
  margin: 0 0 4px;
  color: var(--text-1);
  font-size: 20px;
}

.reports-toolbar p {
  margin: 0;
  color: var(--text-2);
  font-size: 13px;
}

.refresh-button,
.delete-button {
  flex-shrink: 0;
  border-radius: 7px;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 7px 12px;
}

.refresh-button {
  border: 1px solid var(--border-strong);
  background: var(--surface-1);
  color: var(--text-2);
}

.refresh-button:hover:not(:disabled) { color: var(--text-1); }

.delete-button {
  border: 1px solid rgba(224, 85, 85, 0.3);
  background: rgba(224, 85, 85, 0.1);
  color: #e87575;
}

.delete-button:hover:not(:disabled) { background: rgba(224, 85, 85, 0.2); }
.refresh-button:disabled, .delete-button:disabled { cursor: not-allowed; opacity: 0.45; }

.state-msg {
  padding: 16px 0;
  color: var(--text-2);
  font-size: 14px;
}

.state-msg.error { color: #e87575; }

.reports-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--block-bg);
}

.report-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.report-identity {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: var(--text-2);
  font-size: 12px;
}

.report-id { color: #c2b8ff; font-weight: 700; }
.report-user { color: var(--text-1); }

.report-description {
  margin-top: 13px;
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.report-meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  margin: 16px 0 0;
}

.report-meta > div {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 7px;
  background: var(--bg-deep);
}

.report-meta dt {
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-meta dd {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
  margin: 0;
}

.report-meta code {
  color: #c2b8ff;
  font-size: 11px;
  overflow-wrap: anywhere;
}

.element-text {
  overflow: hidden;
  color: var(--text-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.element-details { margin-top: 12px; }
.element-details summary { color: var(--text-2); cursor: pointer; font-size: 11px; }
.element-details pre {
  max-height: 260px;
  overflow: auto;
  margin: 8px 0 0;
  padding: 10px;
  border-radius: 7px;
  background: var(--bg-deep);
  color: var(--text-2);
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-word;
}

@media (max-width: 760px) {
  .admin-reports { padding: 16px; }
  .report-meta { grid-template-columns: 1fr; }
  .reports-toolbar { align-items: center; }
}
</style>
