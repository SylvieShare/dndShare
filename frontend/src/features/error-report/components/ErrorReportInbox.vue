<template>
  <teleport v-if="canReview" to="body">
    <aside
      v-if="reports.length"
      class="review-inbox"
      :class="{ expanded }"
      data-error-report-ignore
    >
      <button
        class="inbox-trigger"
        type="button"
        aria-controls="error-report-review-list"
        :aria-expanded="expanded"
        :aria-hidden="expanded"
        :tabindex="expanded ? -1 : 0"
        :aria-label="`Открыть список заявок: ${reports.length}`"
        @click="expanded = true"
      >{{ reports.length }}</button>

      <section
        id="error-report-review-list"
        class="inbox-panel"
        :aria-hidden="!expanded"
        :inert="!expanded"
      >
          <header class="inbox-head">
            <div>
              <strong>Ошибки на страницах</strong>
              <span>{{ inboxSummary }}</span>
            </div>
            <button type="button" aria-label="Свернуть список" @click="expanded = false">×</button>
          </header>

          <div v-if="loadError" class="inbox-error">{{ loadError }}</div>
          <div class="inbox-list">
            <article
              v-for="report in reports"
              :key="report.id"
              class="inbox-report"
              :class="`state-${statusKey(report).toLowerCase()}`"
              @click="openDetails(report)"
            >
              <div class="report-main-row">
                <span class="report-dot" aria-hidden="true"></span>
                <div class="report-copy">
                  <strong>{{ displayTitle(report) }}</strong>
                  <span v-if="showAuthor(report)" class="report-author">{{ report.userLogin || 'Гость' }}</span>
                </div>
                <span class="report-status">{{ statusLabel(report) }}</span>
                <button
                  v-if="report.status === 'RESOLVED'"
                  class="report-archive"
                  type="button"
                  title="Убрать завершённую заявку в архив"
                  aria-label="Архивировать заявку"
                  @click.stop="archiveReport(report)"
                >×</button>
              </div>

              <div class="report-inline-actions">
                <button v-if="report.waitingForAnswer" type="button" @click.stop="openDetails(report)">Ответить</button>
                <button
                  v-if="report.waitingForSeriousApproval && isAdmin"
                  class="approval-action"
                  type="button"
                  @click.stop="openDetails(report)"
                >Подтвердить</button>
              </div>
            </article>
          </div>

      </section>
    </aside>
  </teleport>

  <AppModal v-if="activeReport" :z-index="9600" extra-wide @close="closeDetails">
    <div class="review-modal" data-error-report-ignore>
      <div class="review-modal-head">
        <div>
          <span class="review-modal-id">Заявка #{{ activeReport.id }}</span>
          <h2>{{ displayTitle(activeReport, 120) }}</h2>
        </div>
        <span class="modal-status" :class="`state-${statusKey(activeReport).toLowerCase()}`">
          {{ statusLabel(activeReport) }}
        </span>
      </div>

      <p class="review-description">{{ activeReport.description }}</p>
      <div v-if="actionError" class="review-action-error">{{ actionError }}</div>
      <dl class="review-meta">
        <div><dt>Автор</dt><dd>{{ activeReport.userLogin || 'Гость' }}</dd></div>
        <div><dt>Страница</dt><dd><code>{{ activeReport.pageUrl }}</code></dd></div>
        <div><dt>Элемент</dt><dd><code>{{ activeReport.element?.selector || '—' }}</code></dd></div>
      </dl>

      <section
        v-if="activeReport.hasScreenshot || activeReport.hasViewportScreenshot"
        class="review-screenshots"
      >
        <figure v-if="activeReport.hasScreenshot">
          <figcaption>Выбранный элемент</figcaption>
          <a :href="reviewScreenshotURL(activeReport.id, 'element')" target="_blank" rel="noopener">
            <img
              :src="reviewScreenshotURL(activeReport.id, 'element')"
              :alt="`Скриншот элемента заявки #${activeReport.id}`"
            />
          </a>
        </figure>
        <figure v-if="activeReport.hasViewportScreenshot">
          <figcaption>Видимая область страницы</figcaption>
          <a :href="reviewScreenshotURL(activeReport.id, 'viewport')" target="_blank" rel="noopener">
            <img
              :src="reviewScreenshotURL(activeReport.id, 'viewport')"
              :alt="`Скриншот страницы заявки #${activeReport.id}`"
            />
          </a>
        </figure>
      </section>

      <section v-if="activeReport.waitingForSeriousApproval" class="serious-approval-box">
        <div class="serious-icon">!</div>
        <div>
          <strong>Требуется подтверждение серьёзного изменения</strong>
          <p>{{ activeReport.seriousChangeReason }}</p>
          <button
            v-if="isAdmin"
            type="button"
            :disabled="approving"
            @click="approveSeriousChange"
          >{{ approving ? 'Подтверждаем…' : 'Подтвердить серьёзное изменение' }}</button>
          <small v-else>Подтвердить может только пользователь с ролью ADMIN.</small>
        </div>
      </section>

      <section class="review-thread">
        <div class="thread-title">История переписки</div>
        <div v-if="activeReport.messages?.length" class="thread-messages">
          <div
            v-for="message in activeReport.messages"
            :key="message.id"
            class="thread-message"
            :class="message.sender === 'AI' ? 'from-ai' : 'from-human'"
          >
            <div>
              <strong>{{ message.sender === 'AI' ? 'Нейронка' : (message.adminUserLogin || 'Проверяющий') }}</strong>
              <time>{{ formatTime(message.createdAt) }}</time>
            </div>
            <p>{{ message.message }}</p>
          </div>
        </div>
        <div v-else class="thread-empty">Переписки пока нет.</div>

        <form v-if="activeReport.waitingForAnswer" class="reply-form" @submit.prevent="sendAnswer">
          <label for="reviewer-error-answer">Ответ нейронке</label>
          <textarea
            id="reviewer-error-answer"
            v-model="answerDraft"
            maxlength="4000"
            rows="4"
            placeholder="Дайте конкретное уточнение, чтобы работа могла продолжиться"
            :disabled="answering"
          />
          <div>
            <span>{{ answerDraft.length }} / 4000</span>
            <button type="submit" :disabled="answering || !answerDraft.trim()">
              {{ answering ? 'Отправляем…' : 'Отправить ответ' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </AppModal>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import AppModal from '@/shared/ui/AppModal.vue'
import { useAccountStore } from '@/stores/account'
import {
  errorReportStatusKey,
  errorReportStatusLabel,
  errorReportDisplayTitle,
  shouldShowErrorReportAuthor,
} from '../lib/errorReportPresentation'
import {
  answerReviewErrorReport,
  approveSeriousErrorReportChange,
  archiveReviewErrorReport,
  getReviewErrorReports,
} from '../api/errorReportReviewApi'

const accountStore = useAccountStore()
const reports = ref([])
const expanded = ref(false)
const loadError = ref('')
const activeReportId = ref(null)
const answerDraft = ref('')
const answering = ref(false)
const approving = ref(false)
const actionError = ref('')
const archivingIds = new Set()

let pollTimer = null
let requestInFlight = false
let lastReportsPayload = ''

const canReview = computed(() => accountStore.user?.roles?.includes('ERROR_REPORT_REVIEWER'))
const isAdmin = computed(() => accountStore.user?.roles?.includes('ADMIN'))
const activeReport = computed(() => reports.value.find(report => report.id === activeReportId.value) || null)
const inboxSummary = computed(() => `${reports.value.length} в обзоре`)

watch(canReview, allowed => {
  stopPolling()
  if (!allowed) {
    reports.value = []
    lastReportsPayload = ''
    expanded.value = false
    closeDetails()
    return
  }
  void loadReports()
  pollTimer = setInterval(loadReports, 1000)
}, { immediate: true })

async function loadReports() {
  if (requestInFlight || !canReview.value) return
  requestInFlight = true
  try {
    const response = await getReviewErrorReports()
    const nextReports = Array.isArray(response.reports) ? response.reports : []
    const nextPayload = JSON.stringify(nextReports)
    if (nextPayload !== lastReportsPayload) {
      reports.value = nextReports
      lastReportsPayload = nextPayload
      if (!nextReports.length) {
        expanded.value = false
        closeDetails()
      }
    }
    loadError.value = ''
    if (activeReportId.value && !activeReport.value) closeDetails()
  } catch {
    loadError.value = 'Не удалось обновить список'
  } finally {
    requestInFlight = false
  }
}

function stopPolling() {
  clearInterval(pollTimer)
  pollTimer = null
}

function openDetails(report) {
  activeReportId.value = report.id
  answerDraft.value = ''
  actionError.value = ''
}

function closeDetails() {
  activeReportId.value = null
  answerDraft.value = ''
  actionError.value = ''
}

async function sendAnswer() {
  const message = answerDraft.value.trim()
  if (!message || !activeReport.value || answering.value) return
  answering.value = true
  actionError.value = ''
  try {
    const created = await answerReviewErrorReport(activeReport.value.id, message)
    if (!Array.isArray(activeReport.value.messages)) activeReport.value.messages = []
    activeReport.value.messages.push(created)
    activeReport.value.waitingForAnswer = false
    answerDraft.value = ''
    await loadReports()
  } catch {
    actionError.value = 'Не удалось отправить ответ. Список обновится автоматически.'
  } finally {
    answering.value = false
  }
}

async function approveSeriousChange() {
  if (!activeReport.value || !isAdmin.value || approving.value) return
  approving.value = true
  actionError.value = ''
  try {
    await approveSeriousErrorReportChange(activeReport.value.id)
    await loadReports()
  } catch {
    actionError.value = 'Не удалось подтвердить изменение. Проверьте роль ADMIN и повторите.'
  } finally {
    approving.value = false
  }
}

async function archiveReport(report) {
  if (archivingIds.has(report.id)) return
  archivingIds.add(report.id)
  try {
    await archiveReviewErrorReport(report.id)
    reports.value = reports.value.filter(item => item.id !== report.id)
    lastReportsPayload = JSON.stringify(reports.value)
    if (!reports.value.length) expanded.value = false
    if (activeReportId.value === report.id) closeDetails()
  } catch {
    loadError.value = `Не удалось архивировать заявку #${report.id}`
  } finally {
    archivingIds.delete(report.id)
  }
}

function showAuthor(report) {
  return shouldShowErrorReportAuthor(report, accountStore.user?.id)
}

function statusKey(report) {
  return errorReportStatusKey(report)
}

function statusLabel(report) {
  return errorReportStatusLabel(report)
}

function displayTitle(report, fallbackLength) {
  return errorReportDisplayTitle(report, fallbackLength)
}

function reviewScreenshotURL(id, kind) {
  const suffix = kind === 'viewport' ? 'viewport-screenshot' : 'screenshot'
  return `/api/error-report-review/reports/${id}/${suffix}`
}

function formatTime(value) {
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

onBeforeUnmount(stopPolling)
</script>

<style scoped src="./styles/ErrorReportInbox.css"></style>
