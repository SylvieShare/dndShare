import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { createErrorReport } from '../api/errorReportApi'
import { describeElement, screenshotContextsFor, selectorFor } from '../lib/errorReportElement'
import { captureSelectedArea, withTimeout } from '../lib/errorReportScreenshot'
import { ERROR_REPORT_REQUEST_EVENT } from '../lib/errorReportLauncher'

export function useErrorReporter() {
  const selecting = ref(false)
  const formOpen = ref(false)
  const submitting = ref(false)
  const description = ref('')
  const submitError = ref('')
  const selectedElement = ref(null)
  const selectedPageURL = ref('')
  const reportForm = ref(null)
  const toast = ref('')
  const screenshotDataURL = ref('')
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
    document.addEventListener('pointerdown', onSelectionPointerDown, true)
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
    document.removeEventListener('pointerdown', onSelectionPointerDown, true)
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

  function onSelectionPointerDown(event) {
    onPointerMove(event)
    if (!eventElement(event)) return
    event.preventDefault()
    event.stopImmediatePropagation()
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
    screenshotError.value = ''
    screenshotCapturing.value = true
    formOpen.value = true
  }

  function onReportModalOpened() {
    // Programmatic focus opens the virtual keyboard on some mobile browsers and
    // changes the visual viewport while the page screenshot is being rendered.
    const capture = pendingScreenshot
    pendingScreenshot = null
    if (!capture || capture.session !== screenshotSession || !formOpen.value) return
    if (!capture.element?.isConnected) {
      screenshotCapturing.value = false
      screenshotError.value = 'Не удалось создать скриншот области.'
      return
    }
    void captureElementScreenshot(capture.element)
  }

  async function captureElementScreenshot(element) {
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

  function onNativeBack(event) {
    if (!selecting.value) return
    event.preventDefault()
    event.stopImmediatePropagation()
    cancelSelection()
  }

  onMounted(() => {
    document.addEventListener('keydown', onGlobalKeydown)
    window.addEventListener(ERROR_REPORT_REQUEST_EVENT, startSelection)
    window.addEventListener('dndshare:back', onNativeBack, true)
  })

  onBeforeUnmount(() => {
    stopSelection()
    resetScreenshot()
    clearTimeout(toastTimer)
    document.removeEventListener('keydown', onGlobalKeydown)
    window.removeEventListener(ERROR_REPORT_REQUEST_EVENT, startSelection)
    window.removeEventListener('dndshare:back', onNativeBack, true)
  })

  return {
    selecting, formOpen, submitting, description,
    submitError, selectedElement, reportForm, toast,
    screenshotDataURL, screenshotCapturing, screenshotError, screenshotContextLevel,
    highlight, highlightStyle, maxScreenshotContextLevel, screenshotContextLabel,
    screenshotFrameStyle, cancelSelection, closeForm, submitReport,
    changeScreenshotContext, onReportModalOpened,
  }
}
