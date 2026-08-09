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

    <div v-if="reports.length" class="report-filters">
      <button
        v-for="filter in filters"
        :key="filter.value"
        type="button"
        :class="{ active: activeFilter === filter.value }"
        @click="activeFilter = filter.value"
      >
        {{ filter.label }} <span>{{ filter.count }}</span>
      </button>
    </div>

    <div v-if="error" class="state-msg error">{{ error }}</div>
    <div v-if="loading && !reports.length" class="state-msg">Загрузка...</div>
    <div v-else-if="!reports.length && !error" class="state-msg">Заявок нет</div>
    <div v-else-if="!filteredReports.length && !error" class="state-msg">В этом разделе заявок нет</div>
    <div v-else-if="filteredReports.length" class="reports-list">
      <article v-for="report in filteredReports" :key="report.id" class="report-card">
        <div class="report-head">
          <div class="report-identity">
            <span class="report-id">#{{ report.id }}</span>
            <span class="report-time">{{ formatTime(report.createdAt) }}</span>
            <span class="report-user">{{ report.userLogin || 'Гость' }}</span>
            <span v-if="report.status === 'RESOLVED'" class="status-badge resolved">В архиве</span>
            <span v-else-if="report.waitingForAnswer" class="status-badge waiting">Ждёт ответа</span>
            <span v-else class="status-badge open">В работе</span>
          </div>
          <div class="report-actions">
            <label v-if="report.status !== 'RESOLVED'" class="approval-toggle" :class="{ approved: report.approved }">
              <input
                type="checkbox"
                :checked="report.approved"
                :disabled="approvingIds.has(report.id)"
                @change="onApprovalChange(report, $event.target.checked)"
              />
              <span>{{ report.approved ? 'Одобрено для MCP' : 'Одобрить для MCP' }}</span>
            </label>
            <button
              v-if="report.status === 'RESOLVED'"
              class="reopen-button"
              type="button"
              :disabled="reopeningIds.has(report.id)"
              @click="onReopen(report)"
            >
              {{ reopeningIds.has(report.id) ? 'Возврат…' : 'Вернуть в работу' }}
            </button>
            <button
              class="delete-button"
              type="button"
              :disabled="deletingIds.has(report.id)"
              @click="onDelete(report)"
            >
              {{ deletingIds.has(report.id) ? 'Удаление…' : 'Удалить навсегда' }}
            </button>
          </div>
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

        <div v-if="report.hasScreenshot" class="report-screenshot">
          <span>Скриншот выбранной области</span>
          <a :href="screenshotURL(report.id)" target="_blank" rel="noopener">
            <img
              :src="screenshotURL(report.id)"
              :alt="`Скриншот заявки #${report.id}`"
              loading="lazy"
            />
          </a>
        </div>

        <details class="element-details">
          <summary>Все данные элемента</summary>
          <pre>{{ formatElement(report.element) }}</pre>
        </details>

        <section v-if="report.status === 'RESOLVED'" class="report-resolution">
          <div class="resolution-head">
            <strong>Результат исправления</strong>
            <span>{{ formatTime(report.resolvedAt) }}</span>
          </div>
          <div class="resolution-text">{{ report.resolution || 'Описание результата не указано' }}</div>
          <code v-if="report.resolvedCommitSha">commit {{ report.resolvedCommitSha }}</code>
        </section>

        <section class="report-feedback">
          <div class="feedback-head">
            <h2>Обратная связь с нейронкой</h2>
            <span v-if="report.waitingForAnswer" class="waiting-badge">Ожидает ответа</span>
            <span v-else-if="report.messages?.length" class="answered-badge">Ответ передан</span>
          </div>

          <div v-if="report.messages?.length" class="feedback-thread">
            <div
              v-for="message in report.messages"
              :key="message.id"
              class="feedback-message"
              :class="message.sender === 'AI' ? 'from-ai' : 'from-admin'"
            >
              <div class="feedback-message-head">
                <strong>{{ message.sender === 'AI' ? 'Нейронка' : (message.adminUserLogin || 'Администратор') }}</strong>
                <span>{{ formatTime(message.createdAt) }}</span>
              </div>
              <div class="feedback-message-text">{{ message.message }}</div>
            </div>
          </div>
          <p v-else class="feedback-empty">Нейронка пока не запрашивала уточнений.</p>

          <form v-if="report.waitingForAnswer" class="feedback-reply" @submit.prevent="onAnswer(report)">
            <textarea
              v-model="replyDrafts[report.id]"
              maxlength="4000"
              rows="3"
              placeholder="Ответьте на вопрос — после этого заявка снова появится в MCP"
              :disabled="answeringIds.has(report.id)"
            />
            <button
              type="submit"
              :disabled="answeringIds.has(report.id) || !replyDrafts[report.id]?.trim()"
            >
              {{ answeringIds.has(report.id) ? 'Отправка…' : 'Ответить' }}
            </button>
          </form>
        </section>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { answerErrorReport, deleteErrorReport, getErrorReports, reopenErrorReport, setErrorReportApproval } from '../api/adminApi'

const reports = ref([])
const loading = ref(true)
const error = ref('')
const deletingIds = reactive(new Set())
const approvingIds = reactive(new Set())
const answeringIds = reactive(new Set())
const reopeningIds = reactive(new Set())
const replyDrafts = reactive({})
const activeFilter = ref('OPEN')

const filters = computed(() => [
  { value: 'OPEN', label: 'В работе', count: reports.value.filter(report => report.status === 'OPEN' && !report.waitingForAnswer).length },
  { value: 'WAITING', label: 'Ждут ответа', count: reports.value.filter(report => report.status === 'OPEN' && report.waitingForAnswer).length },
  { value: 'RESOLVED', label: 'Архив', count: reports.value.filter(report => report.status === 'RESOLVED').length },
  { value: 'ALL', label: 'Все', count: reports.value.length },
])

const filteredReports = computed(() => {
  if (activeFilter.value === 'ALL') return reports.value
  if (activeFilter.value === 'WAITING') {
    return reports.value.filter(report => report.status === 'OPEN' && report.waitingForAnswer)
  }
  if (activeFilter.value === 'RESOLVED') {
    return reports.value.filter(report => report.status === 'RESOLVED')
  }
  return reports.value.filter(report => report.status === 'OPEN' && !report.waitingForAnswer)
})

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
  if (!confirm(`Удалить заявку #${report.id} навсегда вместе с перепиской?`)) return
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

async function onApprovalChange(report, approved) {
  if (approvingIds.has(report.id)) return
  error.value = ''
  const previous = report.approved
  report.approved = approved
  approvingIds.add(report.id)
  try {
    await setErrorReportApproval(report.id, approved)
  } catch {
    report.approved = previous
    error.value = `Не удалось изменить одобрение заявки #${report.id}`
  } finally {
    approvingIds.delete(report.id)
  }
}

async function onAnswer(report) {
  const message = replyDrafts[report.id]?.trim()
  if (!message || answeringIds.has(report.id)) return
  error.value = ''
  answeringIds.add(report.id)
  try {
    const created = await answerErrorReport(report.id, message)
    if (!Array.isArray(report.messages)) report.messages = []
    report.messages.push(created)
    report.waitingForAnswer = false
    replyDrafts[report.id] = ''
  } catch {
    error.value = `Не удалось ответить по заявке #${report.id}`
  } finally {
    answeringIds.delete(report.id)
  }
}

async function onReopen(report) {
  if (reopeningIds.has(report.id)) return
  error.value = ''
  reopeningIds.add(report.id)
  try {
    await reopenErrorReport(report.id)
    report.status = 'OPEN'
    report.resolution = null
    report.resolvedCommitSha = null
    report.resolvedAt = null
    activeFilter.value = 'OPEN'
  } catch {
    error.value = `Не удалось вернуть заявку #${report.id} в работу`
  } finally {
    reopeningIds.delete(report.id)
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

function screenshotURL(id) {
  return `/api/admin-panel/error-reports/${id}/screenshot`
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
.delete-button,
.reopen-button {
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

.reopen-button {
  border: 1px solid rgba(100, 183, 123, 0.3);
  background: rgba(100, 183, 123, 0.1);
  color: #75c58b;
}

.reopen-button:hover:not(:disabled) { background: rgba(100, 183, 123, 0.18); }
.refresh-button:disabled, .delete-button:disabled, .reopen-button:disabled { cursor: not-allowed; opacity: 0.45; }

.state-msg {
  padding: 16px 0;
  color: var(--text-2);
  font-size: 14px;
}

.state-msg.error { color: #e87575; }

.report-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  margin-bottom: 16px;
}

.report-filters button {
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-1);
  color: var(--text-2);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 6px 10px;
}

.report-filters button span { color: var(--text-muted); }
.report-filters button.active {
  border-color: rgba(141, 126, 232, 0.5);
  background: rgba(141, 126, 232, 0.14);
  color: #c2b8ff;
}

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

.report-actions {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 10px;
}

.status-badge {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 700;
}

.status-badge.open { background: rgba(141, 126, 232, 0.14); color: #c2b8ff; }
.status-badge.waiting { background: rgba(232, 184, 90, 0.14); color: #e8b85a; }
.status-badge.resolved { background: rgba(100, 183, 123, 0.14); color: #75c58b; }

.approval-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--text-2);
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
}

.approval-toggle.approved { color: #75c58b; }
.approval-toggle input { accent-color: #64b77b; cursor: pointer; }
.approval-toggle input:disabled { cursor: wait; opacity: 0.6; }

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

.report-screenshot {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  margin-top: 12px;
}

.report-screenshot > span {
  color: var(--text-muted);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.report-screenshot a {
  display: block;
  max-width: min(680px, 100%);
}

.report-screenshot img {
  display: block;
  max-width: 100%;
  max-height: 360px;
  object-fit: contain;
  object-position: left top;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-deep);
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

.report-resolution {
  margin-top: 14px;
  padding: 11px 12px;
  border: 1px solid rgba(100, 183, 123, 0.25);
  border-radius: 8px;
  background: rgba(100, 183, 123, 0.07);
}

.resolution-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--text-muted);
  font-size: 10px;
}

.resolution-head strong { color: #75c58b; }

.resolution-text {
  margin-top: 7px;
  color: var(--text-1);
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-wrap;
}

.report-resolution code {
  display: inline-block;
  margin-top: 7px;
  color: #c2b8ff;
  font-size: 11px;
}

.report-feedback {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border);
}

.feedback-head {
  display: flex;
  align-items: center;
  gap: 9px;
}

.feedback-head h2 {
  margin: 0;
  color: var(--text-1);
  font-size: 13px;
}

.waiting-badge,
.answered-badge {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
}

.waiting-badge {
  background: rgba(232, 184, 90, 0.14);
  color: #e8b85a;
}

.answered-badge {
  background: rgba(100, 183, 123, 0.14);
  color: #75c58b;
}

.feedback-thread {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.feedback-message {
  max-width: min(760px, 94%);
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 9px;
}

.feedback-message.from-ai {
  align-self: flex-start;
  background: var(--bg-deep);
}

.feedback-message.from-admin {
  align-self: flex-end;
  background: rgba(100, 183, 123, 0.08);
  border-color: rgba(100, 183, 123, 0.24);
}

.feedback-message-head {
  display: flex;
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 5px;
  color: var(--text-muted);
  font-size: 10px;
}

.feedback-message-head strong { color: var(--text-2); }

.feedback-message-text {
  color: var(--text-1);
  font-size: 13px;
  line-height: 1.45;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.feedback-empty {
  margin: 9px 0 0;
  color: var(--text-muted);
  font-size: 12px;
}

.feedback-reply {
  display: flex;
  align-items: flex-end;
  gap: 9px;
  margin-top: 10px;
}

.feedback-reply textarea {
  min-height: 74px;
  flex: 1;
  resize: vertical;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  outline: none;
  background: var(--surface-1);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  line-height: 1.4;
  padding: 9px 10px;
}

.feedback-reply textarea:focus { border-color: #8d7ee8; }

.feedback-reply button {
  border: 1px solid rgba(141, 126, 232, 0.45);
  border-radius: 7px;
  background: rgba(141, 126, 232, 0.16);
  color: #c2b8ff;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 8px 13px;
}

.feedback-reply button:disabled,
.feedback-reply textarea:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

@media (max-width: 760px) {
  .admin-reports { padding: 16px; }
  .report-meta { grid-template-columns: 1fr; }
  .reports-toolbar { align-items: center; }
  .report-head { align-items: flex-start; }
  .report-actions { align-items: flex-end; flex-direction: column; }
  .feedback-reply { align-items: stretch; flex-direction: column; }
  .feedback-reply button { align-self: flex-end; }
}
</style>
