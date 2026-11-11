<template>
  <teleport v-if="selecting" to="body">
    <div
      v-show="highlight.visible"
      class="selection-highlight"
      :style="highlightStyle"
      aria-hidden="true"
    />
    <div class="selection-hint" role="status" data-error-report-ignore>
      <div>
        <strong>Выберите проблемный элемент</strong>
        <span>Наведите и нажмите на него</span>
      </div>
      <button type="button" @click="cancelSelection">Отмена · Esc</button>
    </div>
  </teleport>

  <AppModalFrame v-if="formOpen" title="Что работает неправильно?" close-label="Закрыть форму" :dismissible="!submitting" :z-index="9500" wide @opened="onReportModalOpened" @close="closeForm">
    <form id="error-report-form" ref="reportForm" class="report-form" data-error-report-ignore @submit.prevent="submitReport">
      <div class="selected-element">
        <span class="selected-label">Выбранный элемент</span>
        <span v-if="selectedElement?.text" class="selected-text">{{ selectedElement.text }}</span>
      </div>
      <div class="screenshot-field">
        <span class="selected-label">Скриншот области</span>
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
        </div>
      </div>
      <FormField label="Описание" vertical>
        <FormTextarea id="error-report-description" v-model:value="description" :rows="5" maxlength="4000"
          placeholder="Расскажите, что произошло и как должно было работать" :disabled="submitting" />
      </FormField>
      <div class="description-meta">
        <span v-if="submitError" class="submit-error">{{ submitError }}</span>
        <span class="char-count">{{ description.length }} / 4000</span>
      </div>
    </form>
    <template #footer>
      <FormActionButtons submit-text="Отправить" loading-text="Отправка…" :loading="submitting"
        :can-submit="!screenshotCapturing && !!description.trim()" @cancel="closeForm" @submit="submitReport" />
    </template>
  </AppModalFrame>

  <teleport v-if="toast" to="body">
    <div class="report-toast" role="status" data-error-report-ignore>{{ toast }}</div>
  </teleport>
</template>

<script setup>
import { AppModalFrame, FormActionButtons, FormField, FormTextarea } from '@sylvieshare/share-ui'
import { useErrorReporter } from '../composables/useErrorReporter'
const {
  selecting, formOpen, submitting, description,
  submitError, selectedElement, reportForm, toast,
  screenshotDataURL, screenshotCapturing, screenshotError, screenshotContextLevel,
  highlight, highlightStyle, maxScreenshotContextLevel, screenshotContextLabel,
  screenshotFrameStyle, cancelSelection, closeForm, submitReport,
  changeScreenshotContext, onReportModalOpened,
} = useErrorReporter()
</script>

<style scoped src="./styles/ErrorReporter.css"></style>
