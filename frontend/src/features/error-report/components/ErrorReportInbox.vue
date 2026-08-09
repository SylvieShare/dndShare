<template>
  <teleport v-if="canReview" to="body">
    <aside class="review-inbox" :class="{ expanded }" data-error-report-ignore>
      <transition name="inbox-morph" mode="out-in">
        <button
          v-if="!expanded"
          key="trigger"
          class="inbox-trigger"
          type="button"
          aria-expanded="false"
          :disabled="!reports.length"
          @click="expanded = reports.length > 0"
        >
          <span class="inbox-trigger-icon" aria-hidden="true">{{ reports.length ? '⌁' : '✓' }}</span>
          <span class="inbox-trigger-label">{{ reports.length ? 'Заявки' : 'Список пуст' }}</span>
          <span v-if="attentionCount" class="inbox-count">{{ attentionCount }}</span>
        </button>

        <section v-else key="panel" class="inbox-panel">
          <header class="inbox-head">
            <div>
              <strong>Ошибки на страницах</strong>
              <span>{{ inboxSummary }}</span>
            </div>
            <button type="button" aria-label="Свернуть список" @click="expanded = false">×</button>
          </header>

          <div v-if="loadError" class="inbox-error">{{ loadError }}</div>
          <div v-if="!reports.length && !loading" class="inbox-empty">
            <span>✓</span>
            <strong>Всё разобрано</strong>
            <small>Новые заявки появятся автоматически</small>
          </div>

          <div v-else class="inbox-list">
            <article
              v-for="report in displayedReports"
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

          <div v-if="hiddenReportsCount" class="inbox-limit">
            Не показано заявок: {{ hiddenReportsCount }}
          </div>
        </section>
      </transition>
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
const loading = ref(false)
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

const visibleReportsLimit = 8

const canReview = computed(() => accountStore.user?.roles?.includes('ERROR_REPORT_REVIEWER'))
const isAdmin = computed(() => accountStore.user?.roles?.includes('ADMIN'))
const activeReport = computed(() => reports.value.find(report => report.id === activeReportId.value) || null)
const attentionCount = computed(() => reports.value.filter(report => ['OPEN', 'IN_PROGRESS'].includes(report.status)).length)
const displayedReports = computed(() => reports.value.slice(0, visibleReportsLimit))
const hiddenReportsCount = computed(() => Math.max(0, reports.value.length - visibleReportsLimit))
const inboxSummary = computed(() => {
  if (!reports.value.length) return 'Очередь пуста'
  if (!hiddenReportsCount.value) return `${reports.value.length} в обзоре`
  return `Показано ${displayedReports.value.length} из ${reports.value.length}`
})

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
  if (!reports.value.length) loading.value = true
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
    loading.value = false
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

<style scoped>
.review-inbox {
  position: fixed;
  z-index: 9410;
  left: 16px;
  bottom: 62px;
  font-family: var(--font-ui);
}

.inbox-trigger {
  display: flex;
  align-items: center;
  gap: 7px;
  min-height: 36px;
  padding: 7px 10px;
  border: 1px solid color-mix(in srgb, var(--accent) 42%, var(--border-strong));
  border-radius: 12px;
  background: color-mix(in srgb, var(--popup-bg) 94%, transparent);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.38);
  color: var(--text-1);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 700;
  backdrop-filter: blur(12px);
}

.inbox-trigger:disabled {
  border-color: var(--border);
  color: var(--text-muted);
  cursor: default;
}

.inbox-trigger:disabled .inbox-trigger-icon {
  background: color-mix(in srgb, var(--success) 14%, transparent);
  color: var(--success);
}

.inbox-trigger-icon {
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--accent) 22%, transparent);
  color: var(--accent-soft);
  font-size: 17px;
}

.inbox-count {
  min-width: 20px;
  padding: 2px 6px;
  border-radius: 999px;
  background: var(--accent);
  color: white;
  font-size: 10px;
  text-align: center;
}

.inbox-panel {
  position: relative;
  width: min(420px, calc(100vw - 32px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  background: color-mix(in srgb, var(--popup-bg) 97%, transparent);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(124, 92, 226, 0.08);
  backdrop-filter: blur(18px);
}

.inbox-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 16px 13px;
  border-bottom: 1px solid var(--border);
}

.inbox-head > div { display: grid; gap: 3px; }
.inbox-head strong { color: var(--text-1); font-size: 14px; }
.inbox-head span { color: var(--text-muted); font-size: 10px; }
.inbox-head button {
  border: none; background: none; color: var(--text-muted); cursor: pointer; font-size: 20px;
}

.inbox-list {
  padding: 8px;
  overflow: visible;
}

.inbox-report {
  position: relative;
  padding: 10px;
  border: 1px solid transparent;
  border-radius: 11px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.inbox-report:hover {
  z-index: 2;
  border-color: var(--border-strong);
  background: var(--surface-hover);
}

.report-main-row {
  display: flex;
  align-items: center;
  gap: 9px;
}

.report-dot {
  width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: var(--accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--accent) 64%, transparent);
}
.state-answer .report-dot { background: var(--warning); box-shadow: 0 0 12px rgba(252, 190, 36, .35); }
.state-approval .report-dot { background: var(--danger); box-shadow: 0 0 12px rgba(224, 85, 85, .4); }
.state-unapproved .report-dot { background: var(--text-faint); box-shadow: none; }
.state-in_progress .report-dot { background: #5ba9e6; box-shadow: 0 0 12px rgba(91, 169, 230, .42); }
.state-resolved .report-dot { background: var(--success); box-shadow: 0 0 12px rgba(76, 175, 110, .35); }

.report-copy { min-width: 0; flex: 1; display: grid; gap: 2px; }
.report-copy strong { overflow: hidden; color: var(--text-1); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.report-author { color: var(--text-muted); font-size: 9px; }
.report-status { flex: 0 0 auto; color: var(--text-2); font-size: 9px; }
.report-archive {
  width: 23px; height: 23px; border: none; border-radius: 6px; background: transparent;
  color: var(--text-muted); cursor: pointer; font-size: 16px;
}
.report-archive:hover { background: var(--surface-2); color: var(--text-1); }

.report-inline-actions { display: flex; gap: 6px; margin: 7px 0 0 17px; }
.report-inline-actions:empty { display: none; }
.report-inline-actions button {
  border: 1px solid var(--input-border); border-radius: 6px; background: var(--surface-1);
  color: var(--text-2); cursor: pointer; font: inherit; font-size: 9px; padding: 4px 8px;
}
.report-inline-actions .approval-action { border-color: rgba(224, 85, 85, .35); color: #ef9b8f; }

.inbox-empty { display: grid; justify-items: center; gap: 5px; padding: 34px 20px; color: var(--text-2); }
.inbox-empty > span { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: rgba(76,175,110,.14); color: var(--success); }
.inbox-empty small { color: var(--text-muted); }
.inbox-error { padding: 8px 16px; color: #ef8b7b; font-size: 10px; }
.inbox-limit {
  padding: 9px 14px 11px;
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 9px;
  text-align: center;
}

.review-modal { display: grid; gap: 16px; }
.review-modal-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding-right: 26px; }
.review-modal-id { color: var(--text-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .08em; }
.review-modal h2 { margin: 4px 0 0; color: var(--text-1); font-size: 21px; }
.modal-status { padding: 5px 9px; border-radius: 999px; background: var(--surface-1); color: var(--text-2); font-size: 10px; white-space: nowrap; }
.review-description { margin: 0; color: var(--text-2); font-size: 14px; line-height: 1.55; white-space: pre-wrap; }
.review-action-error { padding: 9px 11px; border: 1px solid rgba(224,85,85,.28); border-radius: 8px; background: rgba(224,85,85,.08); color: #ef9b8f; font-size: 11px; }
.review-meta { display: grid; gap: 8px; margin: 0; padding: 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-deep); }
.review-meta div { display: grid; grid-template-columns: 62px 1fr; gap: 10px; }
.review-meta dt { color: var(--text-muted); font-size: 10px; }
.review-meta dd { min-width: 0; margin: 0; color: var(--text-2); font-size: 11px; overflow-wrap: anywhere; }
.review-meta code { color: var(--accent-soft); }

.review-screenshots {
  display: grid;
  gap: 18px;
}

.review-screenshots figure {
  min-width: 0;
  margin: 0;
}

.review-screenshots figcaption {
  margin-bottom: 7px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .07em;
  text-transform: uppercase;
}

.review-screenshots a {
  display: block;
  width: 100%;
}

.review-screenshots img {
  display: block;
  width: 100%;
  max-height: 620px;
  object-fit: contain;
  object-position: left top;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--bg-deep);
}

.serious-approval-box { display: grid; grid-template-columns: 34px 1fr; gap: 12px; padding: 14px; border: 1px solid rgba(224,85,85,.3); border-radius: 12px; background: rgba(224,85,85,.08); }
.serious-icon { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 10px; background: rgba(224,85,85,.18); color: #ef8b7b; font-weight: 800; }
.serious-approval-box strong { color: #f0b0a8; font-size: 13px; }
.serious-approval-box p { margin: 7px 0 10px; color: var(--text-2); font-size: 12px; line-height: 1.45; }
.serious-approval-box button { border: none; border-radius: 8px; background: var(--danger); color: white; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; padding: 8px 12px; }
.serious-approval-box small { color: var(--text-muted); }

.review-thread { display: grid; gap: 10px; }
.thread-title { color: var(--text-1); font-size: 13px; font-weight: 700; }
.thread-messages { display: grid; gap: 8px; max-height: 280px; overflow-y: auto; }
.thread-message { padding: 10px 12px; border-radius: 10px; }
.thread-message.from-ai { margin-right: 38px; background: var(--surface-1); }
.thread-message.from-human { margin-left: 38px; background: color-mix(in srgb, var(--accent) 16%, var(--surface-1)); }
.thread-message > div { display: flex; justify-content: space-between; gap: 12px; }
.thread-message strong { color: var(--text-1); font-size: 10px; }
.thread-message time { color: var(--text-muted); font-size: 9px; }
.thread-message p { margin: 5px 0 0; color: var(--text-2); font-size: 12px; line-height: 1.45; white-space: pre-wrap; }
.thread-empty { padding: 16px; border: 1px dashed var(--border-strong); border-radius: 10px; color: var(--text-muted); font-size: 11px; text-align: center; }
.reply-form { display: grid; gap: 7px; margin-top: 4px; }
.reply-form label { color: var(--text-muted); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; }
.reply-form textarea { width: 100%; resize: vertical; padding: 10px 12px; border: 1px solid var(--input-border); border-radius: 9px; outline: none; background: var(--input-bg); color: var(--text-1); font: inherit; font-size: 13px; line-height: 1.45; }
.reply-form textarea:focus { border-color: var(--accent); }
.reply-form > div { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.reply-form span { color: var(--text-muted); font-size: 9px; }
.reply-form button { border: none; border-radius: 8px; background: var(--accent); color: white; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; padding: 8px 13px; }
.reply-form button:disabled, .serious-approval-box button:disabled { cursor: not-allowed; opacity: .45; }

.inbox-morph-enter-active, .inbox-morph-leave-active {
  transition: opacity .14s ease, transform .18s cubic-bezier(.22, 1, .36, 1);
  transform-origin: left bottom;
}
.inbox-morph-enter-from, .inbox-morph-leave-to { opacity: 0; transform: scale(.82); }

@media (max-width: 640px) {
  .review-inbox { left: 10px; bottom: 58px; }
  .inbox-panel { width: calc(100vw - 20px); }
  .review-screenshots img { max-height: 70dvh; }
  .thread-message.from-ai { margin-right: 12px; }
  .thread-message.from-human { margin-left: 12px; }
}
</style>
