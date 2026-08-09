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
        <span class="selected-label">Скриншот области</span>
        <div v-if="screenshotCapturing && !screenshotDataURL" class="screenshot-state">Создаём снимок…</div>
        <div v-else-if="screenshotDataURL" class="screenshot-previews">
          <figure>
            <figcaption>Выбранный элемент</figcaption>
            <div class="screenshot-preview-frame" :style="screenshotFrameStyle">
              <img
                class="screenshot-preview"
                :src="screenshotDataURL"
                alt="Скриншот выбранного элемента"
              />
            </div>
            <div class="screenshot-context-controls">
              <button
                type="button"
                :disabled="screenshotCapturing || screenshotContextLevel === 0"
                @click="changeScreenshotContext(-1)"
              >Меньше</button>
              <span>{{ screenshotContextLabel }}</span>
              <button
                type="button"
                :disabled="screenshotCapturing || screenshotContextLevel >= maxScreenshotContextLevel"
                @click="changeScreenshotContext(1)"
              >Больше</button>
            </div>
          </figure>
        </div>
        <div v-if="!screenshotCapturing && screenshotError" class="screenshot-state screenshot-state-error">
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
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { toCanvas, toJpeg } from 'html-to-image'
import AppModal from '@/shared/ui/AppModal.vue'
import { createErrorReport } from '../api/errorReportApi'
import { planAncestorCrop, scrollOffsetBetween } from '../lib/screenshotGeometry'

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
const screenshotContextLevel = ref(0)
const screenshotFrameSize = reactive({ width: 0, height: 0 })
const highlight = reactive({ visible: false, top: 0, left: 0, width: 0, height: 0 })

let hoveredElement = null
let toastTimer = null
let screenshotGeneration = 0
let screenshotSession = 0
let pendingScreenshot = null
const screenshotContextElements = ref([])
const semanticAncestorTags = new Set([
  'article', 'aside', 'dialog', 'fieldset', 'footer', 'form', 'header', 'main', 'nav', 'section',
])

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
  screenshotCapturing.value = true
  formOpen.value = true
}

function onReportModalOpened() {
  descriptionInput.value?.focus({ preventScroll: true })
  const capture = pendingScreenshot
  pendingScreenshot = null
  if (!capture || capture.session !== screenshotSession || !formOpen.value) return
  if (!capture.element?.isConnected) {
    screenshotCapturing.value = false
    screenshotError.value = 'Не удалось создать скриншот области.'
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
  try {
    const screenshot = await withTimeout(captureViewport(), 10000)
    if (session === screenshotSession && formOpen.value) {
      viewportScreenshotDataURL.value = screenshot
    }
  } catch {
    // The full viewport is supplemental and must not block the form or hide a successful area crop.
  }
}

function afterNextPaint() {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

async function captureSelectedArea(element) {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) throw new Error('empty screenshot context')
  const backgroundRoot = screenshotCaptureRoot(element)
  const scrollOffset = scrollOffsetBetween(element, backgroundRoot)
  // html-to-image does not preserve scrollTop/scrollLeft on cloned containers.
  // Capture the selected context itself when it sits inside a scrolled parent;
  // otherwise an off-screen part of the unscrolled clone lands in the crop.
  const captureRoot = scrollOffset.left || scrollOffset.top ? element : backgroundRoot
  const plan = planAncestorCrop(rect, captureRoot.getBoundingClientRect())
  if (plan.crop.width <= 0 || plan.crop.height <= 0) throw new Error('empty screenshot crop')
  const scale = Math.max(0.1, Math.min(
    window.devicePixelRatio || 1,
    2,
    2400 / plan.render.width,
    1600 / plan.render.height,
  ))
  const pageCanvas = await renderElementCanvas(captureRoot, plan.render, scale)
  return cropScreenshot(pageCanvas, plan, 0.82)
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

function screenshotContextsFor(element) {
  const contexts = [element]
  let current = element.parentElement
  while (current && current !== document.body && current !== document.documentElement && contexts.length < 4) {
    contexts.push(current)
    current = current.parentElement
  }
  return contexts
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

async function captureViewport() {
  const width = Math.max(1, window.innerWidth)
  const height = Math.max(1, window.innerHeight)
  const scale = Math.max(0.1, Math.min(
    window.devicePixelRatio || 1,
    1.25,
    1600 / width,
    1000 / height,
  ))
  return checkedScreenshot(await toJpeg(document.body, {
    backgroundColor: screenshotBackground(),
    cacheBust: true,
    width,
    height,
    pixelRatio: scale,
    quality: 0.68,
    filter: screenshotFilter,
    style: pageCropStyle(window.scrollX, window.scrollY, width, height),
  }))
}

async function renderElementCanvas(element, render, pixelRatio) {
  return toCanvas(element, {
    backgroundColor: screenshotBackground(element),
    cacheBust: true,
    width: render.width,
    height: render.height,
    pixelRatio,
    filter: screenshotFilter,
    // The crop coordinates are already relative to the root border box. A computed
    // auto-margin (for example the centered character wizard) would otherwise be
    // copied inside the SVG and shift its contents a second time.
    style: { margin: '0' },
  })
}

function cropScreenshot(source, plan, quality) {
  const scaleX = source.width / plan.render.width
  const scaleY = source.height / plan.render.height
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(plan.crop.width * scaleX))
  output.height = Math.max(1, Math.round(plan.crop.height * scaleY))
  const context = output.getContext('2d')
  if (!context) throw new Error('screenshot canvas unavailable')
  context.drawImage(
    source,
    plan.crop.left * scaleX,
    plan.crop.top * scaleY,
    plan.crop.width * scaleX,
    plan.crop.height * scaleY,
    0,
    0,
    output.width,
    output.height,
  )
  return {
    dataURL: checkedScreenshot(output.toDataURL('image/jpeg', quality)),
    width: plan.crop.width,
    height: plan.crop.height,
  }
}

function pageCropStyle(left, top, width, height) {
  return {
    transform: `translate(${-left}px, ${-top}px)`,
    transformOrigin: 'top left',
    width: `${Math.max(document.documentElement.scrollWidth, left + width)}px`,
    height: `${Math.max(document.documentElement.scrollHeight, top + height)}px`,
  }
}

function screenshotCaptureRoot(element) {
  let current = element
  while (current && current !== document.body) {
    if (elementPaintsBackground(current)) return current
    current = current.parentElement
  }
  return document.body
}

function elementPaintsBackground(element) {
  const style = getComputedStyle(element)
  return style.backgroundImage !== 'none' || !isTransparentColor(style.backgroundColor)
}

function isTransparentColor(color) {
  return !color || color === 'transparent' || /rgba?\([^)]*[, /]0(?:\.0+)?\s*\)$/.test(color)
}

function screenshotFilter(node) {
  return !(node instanceof Element && (
    node.matches('.am-overlay, .selection-highlight, .selection-hint, .error-reporter, .report-toast')
    || Boolean(node.closest('[data-error-report-ignore]'))
  ))
}

function screenshotBackground(element = document.body) {
  let current = element
  while (current) {
    const color = getComputedStyle(current).backgroundColor
    if (!isTransparentColor(color)) return color
    current = current.parentElement
  }
  return '#11121a'
}

function checkedScreenshot(dataURL) {
  if (estimatedDataURLBytes(dataURL) > 2 * 1024 * 1024) throw new Error('large screenshot')
  return dataURL
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
    ancestorContext: ancestorContextFor(element),
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

function ancestorContextFor(element) {
  const ancestors = []
  let current = element.parentElement
  while (current && current !== document.body && current !== document.documentElement && ancestors.length < 5) {
    const descriptor = semanticAncestorDescriptor(current)
    if (descriptor) ancestors.push(descriptor)
    current = current.parentElement
  }
  return ancestors.reverse()
}

function semanticAncestorDescriptor(element) {
  const tagName = element.tagName.toLowerCase()
  const hasIdentity = Boolean(
    element.id
    || element.getAttribute('class')?.trim()
    || element.hasAttribute('data-testid')
    || element.hasAttribute('data-test')
    || element.getAttribute('role')
    || element.getAttribute('aria-label')
    || semanticAncestorTags.has(tagName),
  )
  if (!hasIdentity) return null

  return compactObject({
    selectorPart: semanticSelectorPart(element),
    role: element.getAttribute('role') || undefined,
    ariaLabel: element.getAttribute('aria-label') || undefined,
    title: element.getAttribute('title') || undefined,
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

<style scoped>
.report-button {
  position: fixed;
  left: 16px;
  bottom: 16px;
  /* Keep the entry point clickable above every application modal, including the review dialog. */
  z-index: 9700;
  display: inline-flex;
  align-items: center;
  gap: 0;
  min-height: 36px;
  padding: 7px;
  border: 1px solid var(--border-strong);
  border-radius: var(--r-pill);
  background: color-mix(in srgb, var(--popover-bg) 92%, transparent);
  box-shadow: 0 8px 24px color-mix(in srgb, var(--scrim) 48%, transparent);
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
  color: var(--danger);
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
  border: 2px solid var(--danger);
  border-radius: 4px;
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--bg) 55%, transparent), 0 0 24px color-mix(in srgb, var(--danger) 30%, transparent);
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
  border: 1px solid color-mix(in srgb, var(--danger) 45%, transparent);
  border-radius: 12px;
  background: var(--popover-bg);
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
  background: var(--surface-raised);
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
  background: var(--bg);
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
  color: var(--accent-soft);
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
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: left center;
}

.screenshot-preview-frame {
  max-width: 100%;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  transition: width 0.24s cubic-bezier(.22, 1, .36, 1), height 0.24s cubic-bezier(.22, 1, .36, 1);
}

.screenshot-previews {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
}

.screenshot-previews figure {
  margin: 0;
}

.screenshot-previews figcaption {
  margin-bottom: 5px;
  color: var(--text-2);
  font-size: 11px;
}

.screenshot-context-controls {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 7px;
  margin-top: 7px;
}

.screenshot-context-controls span {
  color: var(--text-muted);
  font-size: 10px;
  text-align: center;
}

.screenshot-context-controls button {
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--surface-raised);
  color: var(--text-2);
  cursor: pointer;
  font: inherit;
  font-size: 10px;
  padding: 5px 8px;
}

.screenshot-context-controls button:hover:not(:disabled) {
  border-color: var(--border-strong);
  color: var(--text-1);
}

.screenshot-context-controls button:disabled {
  cursor: not-allowed;
  opacity: 0.38;
}

.screenshot-state {
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg);
  color: var(--text-2);
  font-size: 12px;
}

.screenshot-state-error { color: var(--danger); }

.description-input {
  width: 100%;
  padding: 11px 12px;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  outline: none;
  background: var(--surface-raised);
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  line-height: 1.45;
}

.description-input {
  resize: vertical;
  min-height: 116px;
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

.submit-error { color: var(--danger); font-size: 12px; }
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
  border: 1px solid var(--border-strong);
  background: transparent;
  color: var(--text-2);
}

.submit-button {
  border: none;
  background: var(--accent);
  color: var(--text-on-accent);
  font-weight: 600;
}

.submit-button:hover:not(:disabled) { background: var(--accent-hover); }
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
  background: var(--popover-bg);
  box-shadow: var(--shadow-lg);
  color: var(--text-2);
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
