<template>
  <div class="admin-logs">
    <div class="logs-toolbar">
      <button class="btn-danger" :disabled="!logs.length || deleting" @click="onDeleteAll">
        {{ deleting ? 'Удаление...' : 'Удалить все логи' }}
      </button>
    </div>

    <div v-if="loading" class="state-msg">Загрузка...</div>
    <div v-else-if="error" class="state-msg error">{{ error }}</div>
    <div v-else-if="!logs.length" class="state-msg">Логов нет</div>
    <template v-else>
      <table class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Время</th>
            <th>Путь</th>
            <th>Тип</th>
            <th>Описание</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="col-id">{{ log.id }}</td>
            <td class="col-time">{{ formatTime(log.createdAt) }}</td>
            <td class="col-path">{{ log.path }}</td>
            <td class="col-type">{{ log.type }}</td>
            <td class="col-desc">
              <div class="desc-text">{{ log.desc }}</div>
              <details v-if="log.trace" class="trace-details">
                <summary>stacktrace</summary>
                <pre class="trace-pre">{{ log.trace }}</pre>
              </details>
            </td>
            <td class="col-action">
              <button class="btn-delete" @click="onDelete(log.id)" title="Удалить">×</button>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { deleteAllLogs, deleteLog, getLogs } from '../api/adminApi'

const logs = ref([])
const loading = ref(true)
const error = ref('')
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await getLogs()
    logs.value = res.logs
  } catch {
    error.value = 'Ошибка загрузки логов'
  } finally {
    loading.value = false
  }
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

async function onDelete(id) {
  await deleteLog(id)
  logs.value = logs.value.filter(l => l.id !== id)
}

async function onDeleteAll() {
  if (!confirm('Удалить все логи?')) return
  deleting.value = true
  try {
    await deleteAllLogs()
    logs.value = []
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<style scoped>
.admin-logs {
  padding: 24px;
  overflow-x: auto;
}

.logs-toolbar {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16px;
}

.state-msg {
  color: var(--text-2);
  font-size: 14px;
  padding: 16px 0;
}

.state-msg.error {
  color: var(--danger);
}

.btn-danger {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 6px;
  color: var(--danger);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 5px 14px;
}

.btn-danger:not(:disabled):hover {
  background: color-mix(in srgb, var(--danger) 25%, transparent);
}

.btn-danger:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  color: var(--text-2);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  padding: 8px 12px;
  border-bottom: 1px solid var(--surface-raised);
}

.data-table td {
  padding: 10px 12px;
  border-bottom: 1px solid var(--surface);
  vertical-align: top;
  color: var(--text-1);
}

.col-id {
  color: var(--text-2);
  width: 48px;
}

.col-time {
  white-space: nowrap;
  color: var(--text-2);
  font-size: 12px;
}

.col-path {
  font-family: monospace;
  font-size: 12px;
  white-space: nowrap;
}

.col-type {
  font-size: 12px;
  color: var(--warning);
  white-space: nowrap;
}

.col-desc {
  max-width: 400px;
}

.desc-text {
  color: var(--text-1);
  word-break: break-word;
}

.trace-details {
  margin-top: 4px;
}

.trace-details summary {
  cursor: pointer;
  color: var(--text-2);
  font-size: 11px;
}

.trace-pre {
  font-family: monospace;
  font-size: 10px;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-all;
  margin: 4px 0 0;
  max-height: 200px;
  overflow-y: auto;
}

.col-action {
  width: 40px;
  text-align: center;
}

.btn-delete {
  background: none;
  border: none;
  color: var(--danger);
  cursor: pointer;
  font-size: 18px;
  line-height: 1;
  padding: 0 4px;
  opacity: 0.7;
}

.btn-delete:hover {
  opacity: 1;
}
</style>
