<template>
  <teleport to="body">
    <div class="error-reporter" data-error-report-ignore>
      <button
        v-if="!selecting && !formOpen"
        class="report-button"
        type="button"
        title="Сообщить об ошибке на странице (Alt+Shift+E)"
        aria-label="Сообщить об ошибке на странице"
        @click="startSelection"
      >
        <span class="report-button-icon" aria-hidden="true">!</span>
        <span class="report-button-label">На странице ошибка</span>
      </button>
    </div>
  </teleport>

  <teleport v-if="selecting" to="body">
    <div
      v-show="highlight.visible"
      class="selection-highlight"
      :style="highlightStyle"
      aria-hidden="true"
    />
    <div class="selection-hint" data-error-report-ignore>
      <div>
        <strong>Выберите проблемный элемент</strong>
        <span>Наведите и нажмите на него</span>
      </div>
      <button type="button" @click="cancelSelection">Отмена · Esc</button>
    </div>
  </teleport>

  <AppModal v-if="formOpen" :z-index="9500" @close="closeForm">
    <form class="report-form" data-error-report-ignore @submit.prevent="submitReport">
      <div class="report-form-title">Что работает неправильно?</div>
      <div class="selected-element">
        <span class="selected-label">Выбранный элемент</span>
        <code>{{ selectedElement?.selector }}</code>
        <span v-if="selectedElement?.text" class="selected-text">{{ selectedElement.text }}</span>
      </div>
      <div class="screenshot-field">
        <span class="selected-label">Скриншот области</span>
        <div v-if="screenshotCapturing" class="screenshot-state">Создаём снимок выбранного элемента…</div>
        <img
          v-else-if="screenshotDataURL"
          class="screenshot-preview"
          :src="screenshotDataURL"
          alt="Скриншот выбранного элемента"
        />
        <div v-else-if="screenshotError" class="screenshot-state screenshot-state-error">
          {{ screenshotError }} Заявку можно отправить без снимка.
        </div>
      </div>
      <label class="description-label" for="error-report-description">Описание</label>
      <textarea
        id="error-report-description"
        ref="descriptionInput"
        v-model="description"
        class="description-input"
        rows="5"
        maxlength="4000"
        placeholder="Расскажите, что произошло и как должно было работать"
        :disabled="submitting"
      />
      <div class="description-meta">
        <span v-if="submitError" class="submit-error">{{ submitError }}</span>
        <span class="char-count">{{ description.length }} / 4000</span>
      </div>
      <div class="form-actions">
        <button type="button" class="cancel-button" :disabled="submitting" @click="closeForm">Отмена</button>
        <button type="submit" class="submit-button" :disabled="submitting || screenshotCapturing || !description.trim()">
          {{ submitting ? 'Отправка…' : 'Отправить' }}
        </button>
      </div>
    </form>
  </AppModal>

  <teleport v-if="toast" to="body">
    <div class="report-toast" role="status" data-error-report-ignore>{{ toast }}</div>
  </teleport>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { toJpeg } from 'html-to-image'
import AppModal from '@/shared/ui/AppModal.vue'
import { createErrorReport } from '../api/errorReportApi'

const selecting = ref(false)
const formOpen = ref(false)
const submitting = ref(false)
const description = ref('')
const submitError = ref('')
const selectedElement = ref(null)
const selectedPageURL = ref('')
const descriptionInput = ref(null)
const toast = ref('')
const screenshotDataURL = ref('')
const screenshotCapturing = ref(false)
const screenshotError = ref('')
const highlight = reactive({ visible: false, top: 0, left: 0, width: 0, height: 0 })

let hoveredElement = null
let toastTimer = null
let screenshotGeneration = 0

const highlightStyle = computed(() => ({
  top: `${highlight.top}px`,
  left: `${highlight.left}px`,
  width: `${highlight.width}px`,
  height: `${highlight.height}px`,
}))

function startSelection() {
  if (selecting.value || formOpen.value) return
  submitError.value = ''
  selectedElement.value = null
  hoveredElement = null
  highlight.visible = false
  selecting.value = true
  document.body.classList.add('error-report-selecting')
  document.addEventListener('pointermove', onPointerMove, true)
  document.addEventListener('pointerdown', onPointerMove, true)
  document.addEventListener('click', onElementClick, true)
  window.addEventListener('scroll', refreshHighlight, true)
  window.addEventListener('resize', refreshHighlight)
}

function stopSelection() {
  selecting.value = false
  highlight.visible = false
  hoveredElement = null
  document.body.classList.remove('error-report-selecting')
  document.removeEventListener('pointermove', onPointerMove, true)
  document.removeEventListener('pointerdown', onPointerMove, true)
  document.removeEventListener('click', onElementClick, true)
  window.removeEventListener('scroll', refreshHighlight, true)
  window.removeEventListener('resize', refreshHighlight)
}

function cancelSelection() {
  stopSelection()
}

function eventElement(event) {
  const target = event.target
  if (!(target instanceof Element)) return null
  if (target.closest('[data-error-report-ignore]')) return null
  return target
}

function onPointerMove(event) {
  if (!selecting.value) return
  const target = eventElement(event)
  if (!target) return
  hoveredElement = target
  refreshHighlight()
}

function refreshHighlight() {
  if (!hoveredElement?.isConnected) {
    highlight.visible = false
    return
  }
  const rect = hoveredElement.getBoundingClientRect()
  highlight.top = Math.round(rect.top)
  highlight.left = Math.round(rect.left)
  highlight.width = Math.round(rect.width)
  highlight.height = Math.round(rect.height)
  highlight.visible = rect.width > 0 && rect.height > 0
}

function onElementClick(event) {
  if (!selecting.value) return
  const target = eventElement(event)
  if (!target) return

  event.preventDefault()
  event.stopPropagation()
  event.stopImmediatePropagation()

  selectedElement.value = describeElement(target)
  selectedPageURL.value = window.location.href
  stopSelection()
  formOpen.value = true
  void captureElementScreenshot(target)
  nextTick(() => descriptionInput.value?.focus())
}

async function captureElementScreenshot(element) {
  const generation = ++screenshotGeneration
  screenshotDataURL.value = ''
  screenshotError.value = ''
  screenshotCapturing.value = true
  try {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) throw new Error('empty element')
    const scale = Math.max(0.1, Math.min(
      window.devicePixelRatio || 1,
      2,
      1200 / rect.width,
      800 / rect.height,
    ))
    const dataURL = await withTimeout(toJpeg(element, {
      backgroundColor: getComputedStyle(document.body).backgroundColor || '#11121a',
      cacheBust: true,
      pixelRatio: scale,
      quality: 0.82,
      filter: node => !(node instanceof Element && (
        node.matches('.am-overlay, .selection-highlight, .selection-hint, .error-reporter, .report-toast')
        || Boolean(node.closest('[data-error-report-ignore]'))
      )),
    }), 5000)
    if (generation !== screenshotGeneration) return
    if (estimatedDataURLBytes(dataURL) > 2 * 1024 * 1024) throw new Error('large screenshot')
    screenshotDataURL.value = dataURL
  } catch {
    if (generation === screenshotGeneration) {
      screenshotError.value = 'Не удалось создать скриншот.'
    }
  } finally {
    if (generation === screenshotGeneration) screenshotCapturing.value = false
  }
}

async function withTimeout(promise, milliseconds) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('screenshot timeout')), milliseconds)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

function estimatedDataURLBytes(dataURL) {
  const comma = dataURL.indexOf(',')
  if (comma < 0) return Number.POSITIVE_INFINITY
  return Math.ceil((dataURL.length - comma - 1) * 3 / 4)
}

function describeElement(element) {
  const rect = element.getBoundingClientRect()
  const text = normalizeText(element.innerText || element.textContent || '')
  const classNames = (element.getAttribute('class') || '')
    .split(/\s+/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 12)

  return compactObject({
    selector: selectorFor(element),
    tagName: element.tagName.toLowerCase(),
    id: element.id || undefined,
    classNames: classNames.length ? classNames : undefined,
    text: text || undefined,
    ariaLabel: element.getAttribute('aria-label') || undefined,
    title: element.getAttribute('title') || undefined,
    name: element.getAttribute('name') || undefined,
    type: element.getAttribute('type') || undefined,
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  })
}

function selectorFor(element) {
  if (element.id) {
    const byID = `#${escapeCSS(element.id)}`
    if (isUniqueSelector(byID)) return byID
  }

  const parts = []
  let current = element
  while (current && current !== document.documentElement && parts.length < 8) {
    parts.unshift(semanticSelectorPart(current))
    const candidate = parts.join(' > ')
    if (isUniqueSelector(candidate)) return candidate
    current = current.parentElement
  }
  return parts.join(' > ') || element.tagName.toLowerCase()
}

function semanticSelectorPart(element) {
  if (element.id) return `#${escapeCSS(element.id)}`

  const tagName = element.tagName.toLowerCase()
  const testAttribute = element.hasAttribute('data-testid')
    ? 'data-testid'
    : (element.hasAttribute('data-test') ? 'data-test' : '')
  if (testAttribute) {
    return `${tagName}[${testAttribute}="${escapeAttribute(element.getAttribute(testAttribute))}"]`
  }

  const classes = (element.getAttribute('class') || '')
    .split(/\s+/)
    .map(value => value.trim())
    .filter(Boolean)
    .slice(0, 6)
  if (classes.length) {
    return `${tagName}${classes.map(className => `.${escapeCSS(className)}`).join('')}`
  }

  return tagName
}

function isUniqueSelector(selector) {
  try {
    return document.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

function escapeCSS(value) {
  if (window.CSS?.escape) return window.CSS.escape(value)
  return value.replace(/[^a-zA-Z0-9_-]/g, char => `\\${char}`)
}

function escapeAttribute(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function normalizeText(value) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 240)
}

function compactObject(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined))
}

function closeForm() {
  if (submitting.value) return
  formOpen.value = false
  description.value = ''
  selectedElement.value = null
  selectedPageURL.value = ''
  submitError.value = ''
  resetScreenshot()
}

async function submitReport() {
  const trimmed = description.value.trim()
  if (!trimmed || !selectedElement.value || submitting.value) return

  submitting.value = true
  submitError.value = ''
  try {
    await createErrorReport({
      description: trimmed,
      pageUrl: selectedPageURL.value,
      element: selectedElement.value,
      screenshot: screenshotDataURL.value || undefined,
    })
    closeAfterSubmit()
    showToast('Спасибо! Заявка об ошибке отправлена')
  } catch {
    submitError.value = 'Не удалось отправить заявку. Попробуйте ещё раз.'
  } finally {
    submitting.value = false
  }
}

function closeAfterSubmit() {
  formOpen.value = false
  description.value = ''
  selectedElement.value = null
  selectedPageURL.value = ''
  resetScreenshot()
}

function resetScreenshot() {
  screenshotGeneration += 1
  screenshotDataURL.value = ''
  screenshotCapturing.value = false
  screenshotError.value = ''
}

function showToast(message) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = '' }, 3500)
}

function onGlobalKeydown(event) {
  if (event.key === 'Escape' && selecting.value) {
    event.preventDefault()
    cancelSelection()
    return
  }
  if (event.altKey && event.shiftKey && event.code === 'KeyE') {
    event.preventDefault()
    if (selecting.value) cancelSelection()
    else startSelection()
  }
}

onMounted(() => document.addEventListener('keydown', onGlobalKeydown))

onBeforeUnmount(() => {
  stopSelection()
  clearTimeout(toastTimer)
  document.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped>
.report-button {
  position: fixed;
  left: 16px;
  bottom: 16px;
  /* Above every application modal/menu, but below the report picker and its form. */
  z-index: 9400;
  display: inline-flex;
  align-items: center;
  gap: 0;
  min-height: 36px;
  padding: 7px;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--popup-bg) 92%, transparent);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  color: var(--text-2);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  backdrop-filter: blur(8px);
  overflow: hidden;
  transition: color 0.15s, border-color 0.15s, transform 0.15s;
}

.report-button:hover {
  color: var(--text-1);
  border-color: color-mix(in srgb, var(--danger) 55%, var(--border-strong));
  transform: translateY(-1px);
}

.report-button-icon {
  flex: 0 0 auto;
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--danger) 18%, transparent);
  color: #ef7b7b;
  font-size: 13px;
  font-weight: 800;
}

.report-button-label {
  max-width: 0;
  margin-left: 0;
  overflow: hidden;
  opacity: 0;
  white-space: nowrap;
  transition: max-width 0.2s ease, margin-left 0.2s ease, opacity 0.12s ease;
}

.report-button:hover .report-button-label,
.report-button:focus-visible .report-button-label {
  max-width: 140px;
  margin-left: 8px;
  opacity: 1;
}

.selection-highlight {
  position: fixed;
  z-index: 9498;
  pointer-events: none;
  border: 2px solid #ff6b6b;
  border-radius: 4px;
  background: rgba(255, 107, 107, 0.12);
  box-shadow: 0 0 0 2px rgba(17, 18, 26, 0.55), 0 0 24px rgba(255, 107, 107, 0.3);
  transition: top 0.04s, left 0.04s, width 0.04s, height 0.04s;
}

.selection-hint {
  position: fixed;
  z-index: 9499;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  width: min(520px, calc(100vw - 24px));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px 10px 16px;
  border: 1px solid rgba(255, 107, 107, 0.45);
  border-radius: 12px;
  background: var(--popup-bg);
  box-shadow: var(--shadow-lg);
  color: var(--text-1);
}

.selection-hint div {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.selection-hint strong { font-size: 13px; }
.selection-hint span { color: var(--text-2); font-size: 11px; }

.selection-hint button {
  flex-shrink: 0;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: var(--surface-1);
  color: var(--text-2);
  cursor: pointer;
  font: inherit;
  font-size: 11px;
  padding: 7px 10px;
}

:global(body.error-report-selecting),
:global(body.error-report-selecting *) {
  cursor: crosshair !important;
}

.report-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.report-form-title {
  padding-right: 24px;
  color: var(--text-1);
  font-size: 20px;
  font-weight: 700;
}

.selected-element {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-deep);
  min-width: 0;
}

.selected-label,
.description-label {
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.selected-element code {
  overflow: hidden;
  color: #c2b8ff;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selected-text {
  overflow: hidden;
  color: var(--text-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.screenshot-field {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.screenshot-preview {
  display: block;
  max-width: 100%;
  max-height: 240px;
  object-fit: contain;
  object-position: left center;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-deep);
}

.screenshot-state {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-deep);
  color: var(--text-2);
  font-size: 12px;
}

.screenshot-state-error { color: #ef9b7b; }

.description-input {
  width: 100%;
  resize: vertical;
  min-height: 116px;
  padding: 11px 12px;
  border: 1px solid var(--input-border);
  border-radius: 8px;
  outline: none;
  background: var(--input-bg);
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
}

.description-input:focus { border-color: var(--accent); }
.description-input::placeholder { color: var(--text-muted); }

.description-meta {
  min-height: 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-top: -7px;
}

.submit-error { color: #ef7b7b; font-size: 12px; }
.char-count { margin-left: auto; color: var(--text-muted); font-size: 11px; }

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cancel-button,
.submit-button {
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  padding: 9px 18px;
}

.cancel-button {
  border: 1px solid var(--input-border);
  background: transparent;
  color: var(--text-2);
}

.submit-button {
  border: none;
  background: var(--accent);
  color: #fff;
  font-weight: 600;
}

.submit-button:hover:not(:disabled) { background: var(--accent-dim); }
.cancel-button:disabled, .submit-button:disabled { cursor: not-allowed; opacity: 0.45; }

.report-toast {
  position: fixed;
  z-index: 9600;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  max-width: calc(100vw - 24px);
  padding: 10px 16px;
  border: 1px solid color-mix(in srgb, var(--success) 45%, transparent);
  border-radius: var(--r-pill);
  background: var(--popup-bg);
  box-shadow: var(--shadow-lg);
  color: #8bd3a1;
  font-size: 13px;
  text-align: center;
}

@media (max-width: 640px) {
  .report-button {
    left: 10px;
    bottom: max(10px, env(safe-area-inset-bottom));
  }

  .report-button-label { display: none; }
  .report-button { width: 38px; height: 38px; padding: 8px; justify-content: center; }
  .report-button-icon { width: 22px; height: 22px; }

  .selection-hint { top: max(10px, env(safe-area-inset-top)); }
  .selection-hint span { display: none; }
  .selection-hint button { font-size: 10px; }
}
</style>
