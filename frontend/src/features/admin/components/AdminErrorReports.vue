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
            <span v-if="report.status === 'ARCHIVED'" class="status-badge resolved">В архиве</span>
            <span v-else-if="report.status === 'RESOLVED'" class="status-badge resolved">Завершена</span>
            <span v-else-if="report.status === 'IN_PROGRESS'" class="status-badge processing">В работе</span>
            <span v-else-if="report.waitingForSeriousApproval" class="status-badge serious">Нужно решение ADMIN</span>
            <span v-else-if="report.waitingForAnswer" class="status-badge waiting">Ждёт ответа</span>
            <span v-else-if="!report.approved" class="status-badge waiting">Не одобрена</span>
            <span v-else class="status-badge open">В очереди</span>
          </div>
          <div class="report-actions">
            <label v-if="report.status === 'OPEN'" class="approval-toggle" :class="{ approved: report.approved }">
              <input
                type="checkbox"
                :checked="report.approved"
                :disabled="approvingIds.has(report.id)"
                @change="onApprovalChange(report, $event.target.checked)"
              />
              <span>{{ report.approved ? 'Одобрено для MCP' : 'Одобрить для MCP' }}</span>
            </label>
            <button
              v-if="report.status === 'RESOLVED' || report.status === 'ARCHIVED'"
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

        <h2 class="report-title">{{ displayTitle(report) }}</h2>
        <div class="report-description">{{ report.description }}</div>

        <section v-if="report.waitingForSeriousApproval" class="serious-change-request">
          <div>
            <strong>Нейронка запрашивает подтверждение серьёзной переделки</strong>
            <p>{{ report.seriousChangeReason }}</p>
          </div>
          <button
            type="button"
            :disabled="approvingSeriousIds.has(report.id)"
            @click="onApproveSeriousChange(report)"
          >{{ approvingSeriousIds.has(report.id) ? 'Подтверждение…' : 'Подтвердить изменение' }}</button>
        </section>

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

        <div v-if="report.hasScreenshot || report.hasViewportScreenshot" class="report-screenshots">
          <div v-if="report.hasScreenshot" class="report-screenshot">
            <span>Выбранный элемент</span>
            <a :href="screenshotURL(report.id, 'element')" target="_blank" rel="noopener">
              <img
                :src="screenshotURL(report.id, 'element')"
                :alt="`Скриншот элемента заявки #${report.id}`"
                loading="lazy"
              />
            </a>
          </div>
          <div v-if="report.hasViewportScreenshot" class="report-screenshot">
            <span>Видимая область страницы</span>
            <a :href="screenshotURL(report.id, 'viewport')" target="_blank" rel="noopener">
              <img
                :src="screenshotURL(report.id, 'viewport')"
                :alt="`Скриншот страницы заявки #${report.id}`"
                loading="lazy"
              />
            </a>
          </div>
        </div>

        <details class="element-details">
          <summary>Все данные элемента</summary>
          <pre>{{ formatElement(report.element) }}</pre>
        </details>

        <section v-if="report.status === 'RESOLVED' || report.status === 'ARCHIVED'" class="report-resolution">
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

    <ConfirmDialog
      v-if="deleteTarget"
      title="Удалить заявку навсегда?"
      :message="`Заявка #${deleteTarget.id} и вся переписка будут удалены без возможности восстановления.`"
      confirm-label="Удалить навсегда"
      :loading="deletingIds.has(deleteTarget.id)"
      @cancel="deleteTarget = null"
      @confirm="confirmDelete"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import ConfirmDialog from '@/shared/ui/ConfirmDialog.vue'
import { answerErrorReport, approveSeriousErrorReportChange, deleteErrorReport, getErrorReports, reopenErrorReport, setErrorReportApproval } from '../api/adminApi'
import { errorReportDisplayTitle } from '@/features/error-report/lib/errorReportPresentation'

const reports = ref([])
const deleteTarget = ref(null)
const loading = ref(true)
const error = ref('')
const deletingIds = reactive(new Set())
const approvingIds = reactive(new Set())
const answeringIds = reactive(new Set())
const reopeningIds = reactive(new Set())
const approvingSeriousIds = reactive(new Set())
const replyDrafts = reactive({})
const activeFilter = ref('OPEN')

const filters = computed(() => [
  { value: 'OPEN', label: 'В очереди', count: reports.value.filter(report => report.status === 'OPEN' && !report.waitingForAnswer && !report.waitingForSeriousApproval).length },
  { value: 'IN_PROGRESS', label: 'В работе', count: reports.value.filter(report => report.status === 'IN_PROGRESS').length },
  { value: 'WAITING', label: 'Ждут ответа', count: reports.value.filter(report => report.status === 'OPEN' && report.waitingForAnswer).length },
  { value: 'APPROVAL', label: 'Ждут решения', count: reports.value.filter(report => report.status === 'OPEN' && report.waitingForSeriousApproval).length },
  { value: 'RESOLVED', label: 'Завершены', count: reports.value.filter(report => report.status === 'RESOLVED').length },
  { value: 'ARCHIVED', label: 'Архив', count: reports.value.filter(report => report.status === 'ARCHIVED').length },
  { value: 'ALL', label: 'Все', count: reports.value.length },
])

const filteredReports = computed(() => {
  if (activeFilter.value === 'ALL') return reports.value
  if (activeFilter.value === 'WAITING') {
    return reports.value.filter(report => report.status === 'OPEN' && report.waitingForAnswer)
  }
  if (activeFilter.value === 'IN_PROGRESS') {
    return reports.value.filter(report => report.status === 'IN_PROGRESS')
  }
  if (activeFilter.value === 'APPROVAL') {
    return reports.value.filter(report => report.status === 'OPEN' && report.waitingForSeriousApproval)
  }
  if (activeFilter.value === 'RESOLVED') {
    return reports.value.filter(report => report.status === 'RESOLVED')
  }
  if (activeFilter.value === 'ARCHIVED') {
    return reports.value.filter(report => report.status === 'ARCHIVED')
  }
  return reports.value.filter(report => report.status === 'OPEN' && !report.waitingForAnswer && !report.waitingForSeriousApproval)
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

function onDelete(report) {
  deleteTarget.value = report
}

async function confirmDelete() {
  const report = deleteTarget.value
  if (!report || deletingIds.has(report.id)) return
  deletingIds.add(report.id)
  try {
    const response = await deleteErrorReport(report.id)
    if (!response.ok) throw new Error(String(response.status))
    reports.value = reports.value.filter(item => item.id !== report.id)
    deleteTarget.value = null
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

async function onApproveSeriousChange(report) {
  if (approvingSeriousIds.has(report.id)) return
  error.value = ''
  approvingSeriousIds.add(report.id)
  try {
    await approveSeriousErrorReportChange(report.id)
    report.waitingForSeriousApproval = false
    report.seriousChangeApprovedAt = new Date().toISOString()
    activeFilter.value = 'OPEN'
  } catch {
    error.value = `Не удалось подтвердить серьёзное изменение заявки #${report.id}`
  } finally {
    approvingSeriousIds.delete(report.id)
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

function displayTitle(report) {
  return errorReportDisplayTitle(report, 120)
}

function screenshotURL(id, kind) {
  const suffix = kind === 'viewport' ? 'viewport-screenshot' : 'screenshot'
  return `/api/admin-panel/error-reports/${id}/${suffix}`
}

onMounted(load)
</script>

<style scoped src="./styles/AdminErrorReports.css"></style>
