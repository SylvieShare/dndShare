<template>
  <PageReport :options="options" :messages="messages" />
</template>

<script setup>
import { PageReport } from '@sylvieshare/share-ui'
import { isAndroid } from '@/platform/storage'
import { captureReportViewport } from '@/platform/reportCapture'
import { createErrorReport } from '../api/errorReportApi'
import { platformForViewport } from '../lib/errorReportContext'
import { ERROR_REPORT_REQUEST_EVENT } from '../lib/errorReportLauncher'

const options = {
  requestEvent: ERROR_REPORT_REQUEST_EVENT,
  nativeBackEvent: 'dndshare:back',
  viewportPlatform: platformForViewport,
  captureArea: !isAndroid,
  submit: createErrorReport,
  async renderCanvas(element, settings) {
    const { toCanvas } = await import('html-to-image')
    return toCanvas(element, settings)
  },
  captureViewport: isAndroid ? captureReportViewport : undefined,
}

const messages = {
  "selectTitle": "Выберите проблемный элемент",
  "selectHint": "Наведите и нажмите на него",
  "cancelSelection": "Отмена · Esc",
  "title": "Что работает неправильно?",
  "close": "Закрыть форму",
  "element": "Выбранный элемент",
  "area": "Скриншот области",
  "elementPhoto": "Скриншот элемента",
  "elementHelp": "Выбранная область и контекст",
  "capturing": "Создаём снимок…",
  "less": "Меньше",
  "lessTitle": "Взять меньше контекста",
  "more": "Больше",
  "moreTitle": "Взять больше контекста",
  "viewport": "Экран приложения",
  "viewportHelp": "Автоматический снимок перед открытием формы",
  "description": "Описание",
  "placeholder": "Расскажите, что произошло и как должно было работать",
  "sending": "Отправка…",
  "send": "Отправить",
  "cancel": "Отмена",
  "addArea": "Приложить снимок области",
  "addViewport": "Приложить снимок экрана",
  "exact": "Точная область",
  "context": "Контекст",
  "viewportError": "Не удалось создать снимок экрана. Заявку можно отправить без него.",
  "areaError": "Не удалось создать скриншот области.",
  "contextError": "Не удалось изменить область снимка.",
  "submitted": "Спасибо! Заявка об ошибке отправлена",
  "submitError": "Не удалось отправить заявку. Попробуйте ещё раз.",
  "optionalScreenshot": "Заявку можно отправить без снимка элемента."
}
</script>
