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

  <AppModal v-if="formOpen" :z-index="9500" wide @opened="onReportModalOpened" @close="closeForm">
    <form ref="reportForm" class="report-form" data-error-report-ignore @submit.prevent="submitReport">
      <div class="report-form-title">Что работает неправильно?</div>
      <div class="selected-element">
        <span class="selected-label">Выбранный элемент</span>
        <code>{{ selectedElement?.selector }}</code>
        <span v-if="selectedElement?.text" class="selected-text">{{ selectedElement.text }}</span>
      </div>
      <div class="screenshot-field">
        <span class="selected-label">Скриншоты</span>
        <div class="screenshot-previews">
          <figure class="screenshot-preview-card screenshot-preview-card-element">
            <figcaption>
              <strong>Скриншот элемента</strong>
              <span>Выбранная область и контекст</span>
            </figcaption>
            <div v-if="screenshotCapturing && !screenshotDataURL" class="screenshot-state screenshot-state-inside">
              Создаём снимок…
            </div>
            <div v-else-if="screenshotDataURL" class="screenshot-preview-frame" :style="screenshotFrameStyle">
              <img
                class="screenshot-preview"
                :src="screenshotDataURL"
                alt="Скриншот выбранного элемента"
              />
              <button
                class="screenshot-context-button screenshot-context-button-less"
                type="button"
                title="Взять меньше контекста"
                aria-label="Взять меньше контекста"
                :disabled="screenshotCapturing || screenshotContextLevel === 0"
                @click="changeScreenshotContext(-1)"
              ><span aria-hidden="true">‹</span> Меньше</button>
              <span class="screenshot-context-label">{{ screenshotContextLabel }}</span>
              <button
                class="screenshot-context-button screenshot-context-button-more"
                type="button"
                title="Взять больше контекста"
                aria-label="Взять больше контекста"
                :disabled="screenshotCapturing || screenshotContextLevel >= maxScreenshotContextLevel"
                @click="changeScreenshotContext(1)"
              >Больше <span aria-hidden="true">›</span></button>
            </div>
            <div v-if="!screenshotCapturing && screenshotError" class="screenshot-state screenshot-state-error screenshot-state-inside">
              {{ screenshotError }} Заявку можно отправить без снимка элемента.
            </div>
          </figure>

          <figure class="screenshot-preview-card screenshot-preview-card-viewport">
            <figcaption>
              <strong>Скриншот страницы</strong>
              <span>Вся видимая область экрана</span>
            </figcaption>
            <div class="viewport-preview-frame">
              <img
                v-if="viewportScreenshotDataURL"
                class="viewport-preview"
                :src="viewportScreenshotDataURL"
                alt="Скриншот видимой области страницы"
              />
              <div v-else-if="viewportScreenshotCapturing" class="screenshot-state screenshot-state-inside">
                Создаём снимок страницы…
              </div>
              <div v-else class="screenshot-state screenshot-state-inside" :class="{ 'screenshot-state-error': viewportScreenshotError }">
                {{ viewportScreenshotError || 'Снимок страницы недоступен.' }}
              </div>
            </div>
          </figure>
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import AppModal from '@/shared/ui/AppModal.vue'
import { createErrorReport } from '../api/errorReportApi'
import { describeElement, screenshotContextsFor, selectorFor } from '../lib/errorReportElement'
import { platformForViewport } from '../lib/errorReportContext'
import { captureSelectedArea, captureViewport, withTimeout } from '../lib/errorReportScreenshot'

const selecting = ref(false)
const formOpen = ref(false)
const submitting = ref(false)
const description = ref('')
const submitError = ref('')
const selectedElement = ref(null)
const selectedPageURL = ref('')
const reportForm = ref(null)
const descriptionInput = ref(null)
const toast = ref('')
const screenshotDataURL = ref('')
const viewportScreenshotDataURL = ref('')
const screenshotCapturing = ref(false)
const screenshotError = ref('')
const viewportScreenshotCapturing = ref(false)
const viewportScreenshotError = ref('')
const screenshotContextLevel = ref(0)
const screenshotFrameSize = reactive({ width: 0, height: 0 })
const highlight = reactive({ visible: false, top: 0, left: 0, width: 0, height: 0 })

let hoveredElement = null
let toastTimer = null
let screenshotGeneration = 0
let screenshotSession = 0
let pendingScreenshot = null
const screenshotContextElements = ref([])

const highlightStyle = computed(() => ({
  top: `${highlight.top}px`,
  left: `${highlight.left}px`,
  width: `${highlight.width}px`,
  height: `${highlight.height}px`,
}))

const maxScreenshotContextLevel = computed(() => Math.max(0, screenshotContextElements.value.length - 1))
const screenshotContextLabel = computed(() => screenshotContextLevel.value === 0
  ? 'Точная область'
  : `Контекст +${screenshotContextLevel.value}`)
const screenshotFrameStyle = computed(() => ({
  width: `${screenshotFrameSize.width}px`,
  height: `${screenshotFrameSize.height}px`,
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
  screenshotContextElements.value = screenshotContextsFor(target)
  screenshotContextLevel.value = 0
  updateScreenshotContextMetadata()
  selectedPageURL.value = window.location.href
  stopSelection()
  const session = ++screenshotSession
  pendingScreenshot = { element: target, session }
  screenshotDataURL.value = ''
  viewportScreenshotDataURL.value = ''
  screenshotError.value = ''
  viewportScreenshotError.value = ''
  screenshotCapturing.value = true
  viewportScreenshotCapturing.value = true
  formOpen.value = true
}

function onReportModalOpened() {
  // Programmatic focus opens the virtual keyboard on some mobile browsers and
  // changes the visual viewport while the page screenshot is being rendered.
  if (platformForViewport(window.innerWidth) !== 'mobile') {
    descriptionInput.value?.focus({ preventScroll: true })
  }
  const capture = pendingScreenshot
  pendingScreenshot = null
  if (!capture || capture.session !== screenshotSession || !formOpen.value) return
  if (!capture.element?.isConnected) {
    screenshotCapturing.value = false
    screenshotError.value = 'Не удалось создать скриншот области.'
    void captureViewportScreenshot(capture.session)
    return
  }
  void captureElementScreenshot(capture.element, capture.session)
}

async function captureElementScreenshot(element, session) {
  const generation = ++screenshotGeneration
  screenshotCapturing.value = true
  try {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) throw new Error('empty element')
    const elementResult = await withTimeout(captureSelectedArea(element), 10000)
    if (generation !== screenshotGeneration) return
    applyElementScreenshot(elementResult)
  } catch {
    if (generation === screenshotGeneration) {
      screenshotError.value = 'Не удалось создать скриншот области.'
    }
  } finally {
    if (generation === screenshotGeneration) screenshotCapturing.value = false
  }

  if (session !== screenshotSession || !formOpen.value) return
  await afterNextPaint()
  if (session === screenshotSession && formOpen.value) void captureViewportScreenshot(session)
}

async function captureViewportScreenshot(session) {
  if (session !== screenshotSession || !formOpen.value) return
  viewportScreenshotCapturing.value = true
  viewportScreenshotError.value = ''
  try {
    const screenshot = await withTimeout(captureViewport(), 10000)
    if (session === screenshotSession && formOpen.value) {
      viewportScreenshotDataURL.value = screenshot
    }
  } catch {
    if (session === screenshotSession && formOpen.value) {
      viewportScreenshotError.value = 'Не удалось создать скриншот страницы.'
    }
  } finally {
    if (session === screenshotSession) viewportScreenshotCapturing.value = false
  }
}

function afterNextPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

function applyElementScreenshot(capture) {
  const availableWidth = reportForm.value?.clientWidth || capture.width
  const displayScale = Math.min(1, availableWidth / capture.width, 420 / capture.height)
  screenshotDataURL.value = capture.dataURL
  screenshotFrameSize.width = Math.max(1, Math.round(capture.width * displayScale))
  screenshotFrameSize.height = Math.max(1, Math.round(capture.height * displayScale))
}

async function changeScreenshotContext(delta) {
  const nextLevel = Math.max(0, Math.min(
    maxScreenshotContextLevel.value,
    screenshotContextLevel.value + delta,
  ))
  if (nextLevel === screenshotContextLevel.value || screenshotCapturing.value) return

  const previousLevel = screenshotContextLevel.value
  const previousScreenshot = screenshotDataURL.value
  const previousFrameSize = { ...screenshotFrameSize }
  screenshotContextLevel.value = nextLevel
  updateScreenshotContextMetadata()
  screenshotError.value = ''
  screenshotCapturing.value = true
  const generation = ++screenshotGeneration
  try {
    const contextElement = screenshotContextElements.value[nextLevel]
    if (!contextElement?.isConnected) throw new Error('context element detached')
    const capture = await withTimeout(captureSelectedArea(contextElement), 7000)
    if (generation !== screenshotGeneration) return
    applyElementScreenshot(capture)
  } catch {
    if (generation === screenshotGeneration) {
      screenshotContextLevel.value = previousLevel
      screenshotDataURL.value = previousScreenshot
      Object.assign(screenshotFrameSize, previousFrameSize)
      updateScreenshotContextMetadata()
      screenshotError.value = 'Не удалось изменить область снимка.'
    }
  } finally {
    if (generation === screenshotGeneration) screenshotCapturing.value = false
  }
}

function updateScreenshotContextMetadata() {
  if (!selectedElement.value) return
  const contextElement = screenshotContextElements.value[screenshotContextLevel.value]
  selectedElement.value = {
    ...selectedElement.value,
    screenshotContextLevel: screenshotContextLevel.value,
    screenshotContextSelector: contextElement ? selectorFor(contextElement) : selectedElement.value.selector,
  }
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
      viewportScreenshot: viewportScreenshotDataURL.value || undefined,
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
  screenshotSession += 1
  pendingScreenshot = null
  screenshotDataURL.value = ''
  viewportScreenshotDataURL.value = ''
  screenshotCapturing.value = false
  screenshotError.value = ''
  viewportScreenshotCapturing.value = false
  viewportScreenshotError.value = ''
  screenshotContextLevel.value = 0
  screenshotContextElements.value = []
  screenshotFrameSize.width = 0
  screenshotFrameSize.height = 0
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

<style scoped src="./styles/ErrorReporter.css"></style>
