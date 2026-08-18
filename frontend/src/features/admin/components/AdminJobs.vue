<template>
  <div class="admin-jobs">
    <section class="section">
      <h2 class="section-title">Доступные задачи</h2>
      <div v-if="startError" class="state-msg error">{{ startError }}</div>
      <div v-if="loadingAvailable" class="state-msg">Загрузка...</div>
      <div v-else-if="!available.length" class="state-msg">Нет доступных задач</div>
      <div v-else class="jobs-grid">
        <div v-for="job in available" :key="job.code" class="job-card">
          <div class="job-card-head">
            <div class="job-card-name">{{ job.name }}</div>
            <button
              class="btn-primary"
              :disabled="isRunning(job.code) || startingCode === job.code"
              @click="onStart(job)"
            >
              {{ startingCode === job.code ? 'Запуск...' : isRunning(job.code) ? 'Выполняется' : 'Запустить' }}
            </button>
          </div>
          <div v-if="job.description" class="job-card-desc">{{ job.description }}</div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">История запусков</h2>
      <div v-if="loadingRuns" class="state-msg">Загрузка...</div>
      <div v-else-if="!runs.length" class="state-msg">Запусков нет</div>
      <table v-else class="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Задача</th>
            <th>Статус</th>
            <th>Прогресс</th>
            <th>Старт</th>
            <th>Длительность</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="run in runs" :key="run.id">
            <td class="col-id">{{ run.id }}</td>
            <td>
              <div class="run-name">{{ run.name }}</div>
              <div class="run-code">{{ run.code }}</div>
            </td>
            <td><span class="status-chip" :class="`status-${run.status.toLowerCase()}`">{{ statusLabel(run.status) }}</span></td>
            <td class="col-progress">
              <div class="progress-line">
                <div v-if="run.total != null" class="progress-bar">
                  <div class="progress-bar-fill" :style="{ width: percent(run) + '%' }"></div>
                </div>
                <div class="progress-num">
                  <template v-if="run.total != null">{{ run.current }} / {{ run.total }} ({{ percent(run) }}%)</template>
                  <template v-else>{{ run.current }}</template>
                </div>
              </div>
              <div v-if="run.message" class="run-message">{{ run.message }}</div>
            </td>
            <td class="col-time">{{ formatTime(run.startedAt) }}</td>
            <td class="col-time">{{ duration(run) }}</td>
            <td class="col-action">
              <button
                v-if="run.status === 'RUNNING'"
                class="btn-danger-sm"
                @click="onCancel(run)"
              >Отмена</button>
              <button
                v-if="run.result || run.error"
                class="btn-link"
                @click="toggleDetails(run.id)"
              >{{ openDetails[run.id] ? 'Скрыть' : 'Детали' }}</button>
            </td>
          </tr>
          <template v-for="run in runs">
            <tr v-if="openDetails[run.id]" :key="`d-${run.id}`" class="details-row">
              <td colspan="7">
                <div v-if="run.error" class="details-block error">
                  <div class="details-label">Ошибка:</div>
                  <pre class="details-pre">{{ run.error }}</pre>
                </div>
                <div v-if="run.result" class="details-block">
                  <div class="details-label">Результат:</div>
                  <pre class="details-pre">{{ formatResult(run.result) }}</pre>
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </section>

    <ConfirmDialog
      v-if="cancelTarget"
      title="Отменить задачу?"
      :message="cancelTarget.name"
      confirm-label="Отменить задачу"
      :loading="cancelling"
      @cancel="cancelTarget = null"
      @confirm="confirmCancel"
    />
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ConfirmDialog } from '@sylvieshare/share-ui'
import { cancelJob, getAvailableJobs, getJobRuns, startJob } from '../api/adminJobsApi'

const available = ref([])
const runs = ref([])
const loadingAvailable = ref(true)
const loadingRuns = ref(true)
const startingCode = ref('')
const startError = ref('')
const openDetails = reactive({})
const cancelTarget = ref(null)
const cancelling = ref(false)

let pollTimer = null

const runningCodes = computed(() => new Set(runs.value.filter(r => r.status === 'RUNNING').map(r => r.code)))

function isRunning(code) {
  return runningCodes.value.has(code)
}

function hasRunning() {
  return runs.value.some(r => r.status === 'RUNNING')
}

async function loadAvailable() {
  loadingAvailable.value = true
  try {
    const res = await getAvailableJobs()
    available.value = res.jobs
  } finally {
    loadingAvailable.value = false
  }
}

async function loadRuns() {
  try {
    const res = await getJobRuns()
    runs.value = res.runs
  } finally {
    loadingRuns.value = false
  }
}

function schedulePoll() {
  if (pollTimer) return
  pollTimer = setInterval(async () => {
    await loadRuns()
    if (!hasRunning()) {
      clearInterval(pollTimer)
      pollTimer = null
    }
  }, 1500)
}

async function onStart(job) {
  startError.value = ''
  startingCode.value = job.code
  try {
    await startJob(job.code)
    await loadRuns()
    schedulePoll()
  } catch (e) {
    startError.value = `Не удалось запустить: ${e?.message || e}`
  } finally {
    startingCode.value = ''
  }
}

function onCancel(run) {
  cancelTarget.value = run
}

async function confirmCancel() {
  if (!cancelTarget.value || cancelling.value) return
  cancelling.value = true
  try {
    await cancelJob(cancelTarget.value.id)
    cancelTarget.value = null
    await loadRuns()
  } finally {
    cancelling.value = false
  }
}

function toggleDetails(id) {
  openDetails[id] = !openDetails[id]
}

function statusLabel(s) {
  switch (s) {
    case 'RUNNING': return 'Выполняется'
    case 'SUCCESS': return 'Успешно'
    case 'FAILED': return 'Ошибка'
    case 'CANCELLED': return 'Отменена'
    default: return s
  }
}

function percent(run) {
  if (!run.total || run.total <= 0) return 0
  return Math.min(100, Math.round((run.current / run.total) * 100))
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function duration(run) {
  if (!run.startedAt) return ''
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now()
  const ms = end - new Date(run.startedAt).getTime()
  if (ms < 1000) return `${ms} мс`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s} с`
  const m = Math.floor(s / 60)
  const rs = s % 60
  return `${m} м ${rs} с`
}

function formatResult(r) {
  try {
    return JSON.stringify(r, null, 2)
  } catch {
    return String(r)
  }
}

onMounted(async () => {
  await Promise.all([loadAvailable(), loadRuns()])
  if (hasRunning()) schedulePoll()
})

onBeforeUnmount(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
})
</script>

<style scoped>
.admin-jobs {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  margin: 0 0 12px;
}

.state-msg {
  color: var(--text-2);
  font-size: 14px;
  padding: 12px 0;
}

.jobs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.job-card {
  background: var(--surface-active, var(--popover-bg));
  border: 1px solid var(--border-strong);
  border-radius: 10px;
  padding: 14px 16px;
}

.job-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.job-card-name {
  font-weight: 600;
  color: var(--text-1);
  font-size: 14px;
}

.job-card-desc {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
}

.btn-primary {
  background: var(--accent);
  border: none;
  border-radius: 6px;
  color: var(--text-on-accent);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 6px 14px;
}

.btn-primary:not(:disabled):hover {
  background: var(--accent);
}

.btn-primary:disabled {
  opacity: 0.5;
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

.col-progress {
  min-width: 200px;
}

.col-action {
  white-space: nowrap;
}

.run-name {
  color: var(--text-1);
}

.run-code {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-2);
}

.status-chip {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}

.status-running {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent-soft);
}

.status-success {
  background: color-mix(in srgb, var(--success) 18%, transparent);
  color: var(--success);
}

.status-failed {
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: var(--danger);
}

.status-cancelled {
  background: color-mix(in srgb, var(--text-2) 18%, transparent);
  color: var(--text-2);
}

.progress-line {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: var(--surface-raised);
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.progress-num {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.run-message {
  font-size: 11px;
  color: var(--text-2);
  margin-top: 4px;
  word-break: break-word;
}

.btn-danger-sm {
  background: color-mix(in srgb, var(--danger) 15%, transparent);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
  border-radius: 6px;
  color: var(--danger);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 3px 10px;
  margin-right: 6px;
}

.btn-danger-sm:hover {
  background: color-mix(in srgb, var(--danger) 25%, transparent);
}

.btn-link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 0;
}

.btn-link:hover {
  text-decoration: underline;
}

.details-row td {
  background: var(--bg);
  padding: 12px 16px;
}

.details-block + .details-block {
  margin-top: 8px;
}

.details-label {
  font-size: 11px;
  color: var(--text-2);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.details-block.error .details-label {
  color: var(--danger);
}

.details-pre {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-1);
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  max-height: 280px;
  overflow-y: auto;
}
</style>
