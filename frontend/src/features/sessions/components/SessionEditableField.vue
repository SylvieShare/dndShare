<template>
  <article
    class="session-editable-field"
    :class="{
      'session-editable-field--open': fieldOpen,
      'session-editable-field--wide': wide,
      'session-editable-field--empty': !displayText,
    }"
  >
    <header>
      <span class="session-editable-field-label">
        <component :is="icon" v-if="icon" :size="15" />
        <strong>{{ label }}</strong>
      </span>
      <slot name="actions" />
      <button
        v-if="editable && !forceOpen && !localOpen"
        type="button"
        class="session-editable-field-pencil"
        :aria-label="`Редактировать поле «${label}»`"
        :title="`Редактировать: ${label}`"
        @click="open"
      >
        <Pencil :size="14" />
      </button>
    </header>

    <div v-if="fieldOpen" class="session-editable-field-editor">
      <textarea
        v-if="multiline"
        ref="inputElement"
        :value="editorValue"
        :rows="rows"
        :maxlength="maxlength || undefined"
        :placeholder="placeholder"
        :disabled="saving"
        @input="updateValue($event.target.value)"
        @keydown.meta.enter.prevent="submit"
        @keydown.ctrl.enter.prevent="submit"
        @keydown.esc.prevent="cancel"
      />
      <input
        v-else
        ref="inputElement"
        :value="editorValue"
        type="text"
        :maxlength="maxlength || undefined"
        :placeholder="placeholder"
        :disabled="saving"
        @input="updateValue($event.target.value)"
        @keydown.enter.prevent="submit"
        @keydown.esc.prevent="cancel"
      />
      <div v-if="!forceOpen" class="session-editable-field-controls">
        <span>⌘ Enter — сохранить</span>
        <button type="button" :disabled="saving" aria-label="Отменить" title="Отменить" @click="cancel"><X :size="15" /></button>
        <button type="button" class="primary" :disabled="saving || !canSave" aria-label="Сохранить" title="Сохранить" @click="submit">
          <LoaderCircle v-if="saving" class="session-editable-field-spinner" :size="15" />
          <Check v-else :size="15" />
        </button>
      </div>
    </div>
    <p v-else>{{ displayText || emptyText }}</p>
  </article>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { Check, LoaderCircle, Pencil, X } from '@lucide/vue'

const props = defineProps({
  modelValue: { type: [String, Number], default: '' },
  label: { type: String, required: true },
  icon: { type: [Object, Function], default: null },
  editable: { type: Boolean, default: false },
  forceOpen: { type: Boolean, default: false },
  multiline: { type: Boolean, default: true },
  rows: { type: Number, default: 5 },
  maxlength: { type: Number, default: 0 },
  placeholder: { type: String, default: '' },
  emptyText: { type: String, default: 'Пока не заполнено.' },
  saving: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  wide: { type: Boolean, default: false },
  autofocus: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'save'])
const localOpen = ref(false)
const localValue = ref(String(props.modelValue ?? ''))
const inputElement = ref(null)
const fieldOpen = computed(() => props.forceOpen || localOpen.value)
const editorValue = computed(() => props.forceOpen ? String(props.modelValue ?? '') : localValue.value)
const displayText = computed(() => String(props.modelValue ?? '').trim())
const canSave = computed(() => !props.required || editorValue.value.trim().length > 0)

watch(() => props.modelValue, value => {
  if (!localOpen.value) localValue.value = String(value ?? '')
})

if (props.forceOpen && props.autofocus) nextTick(() => inputElement.value?.focus())

function open() {
  localValue.value = String(props.modelValue ?? '')
  localOpen.value = true
  nextTick(() => inputElement.value?.focus())
}

function updateValue(value) {
  if (props.forceOpen) emit('update:modelValue', value)
  else localValue.value = value
}

function cancel() {
  if (props.forceOpen) return
  localValue.value = String(props.modelValue ?? '')
  localOpen.value = false
}

function submit() {
  if (props.forceOpen || props.saving || !canSave.value) return
  emit('save', localValue.value)
  localOpen.value = false
}
</script>

<style scoped>
.session-editable-field { min-width: 0; display: flex; flex-direction: column; gap: 9px; padding: 14px 15px; border: 1px solid var(--border); border-radius: 11px; background: color-mix(in srgb, var(--surface-raised) 78%, transparent); transition: border-color .15s, background .15s, box-shadow .15s; }
.session-editable-field--wide { grid-column: 1 / -1; }
.session-editable-field--open { border-color: color-mix(in srgb, var(--entity-detail-color, var(--accent)) 48%, var(--border)); background: color-mix(in srgb, var(--entity-detail-color, var(--accent)) 7%, var(--surface-raised)); box-shadow: 0 10px 28px color-mix(in srgb, var(--bg) 26%, transparent); }
.session-editable-field header { min-width: 0; display: flex; align-items: center; gap: 8px; }
.session-editable-field-label { min-width: 0; display: inline-flex; flex: 1; align-items: center; gap: 7px; color: color-mix(in srgb, var(--entity-detail-color, var(--accent)) 78%, var(--text-1)); }
.session-editable-field-label strong { overflow: hidden; font-size: 9px; font-weight: 800; letter-spacing: .09em; text-overflow: ellipsis; text-transform: uppercase; white-space: nowrap; }
.session-editable-field-pencil, .session-editable-field-controls button { width: 30px; height: 30px; display: grid; flex: none; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface) 74%, transparent); color: var(--text-muted); cursor: pointer; }
.session-editable-field-pencil:hover, .session-editable-field-controls button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--entity-detail-color, var(--accent)) 54%, var(--border)); color: var(--text-1); }
.session-editable-field p { margin: 0; color: var(--text-2); font-family: var(--font-prose); font-size: 12px; line-height: 1.65; white-space: pre-wrap; }
.session-editable-field--empty p { color: var(--text-muted); font-family: var(--font-ui); font-style: italic; }
.session-editable-field-editor { display: flex; flex-direction: column; gap: 8px; }
.session-editable-field-editor textarea, .session-editable-field-editor input { box-sizing: border-box; width: 100%; border: 1px solid color-mix(in srgb, var(--entity-detail-color, var(--accent)) 38%, var(--border)); border-radius: 9px; outline: 0; background: var(--surface); color: var(--text-1); font: 12px/1.55 var(--font-prose); resize: vertical; }
.session-editable-field-editor textarea { min-height: 82px; padding: 10px 11px; }
.session-editable-field-editor input { min-height: 40px; padding: 8px 11px; font-family: var(--font-ui); }
.session-editable-field-editor textarea:focus, .session-editable-field-editor input:focus { border-color: var(--entity-detail-color, var(--accent)); box-shadow: 0 0 0 3px color-mix(in srgb, var(--entity-detail-color, var(--accent)) 14%, transparent); }
.session-editable-field-controls { display: flex; align-items: center; justify-content: flex-end; gap: 6px; }
.session-editable-field-controls span { margin-right: auto; color: var(--text-muted); font-size: 8px; }
.session-editable-field-controls button.primary { border-color: color-mix(in srgb, var(--entity-detail-color, var(--accent)) 72%, var(--border)); background: var(--entity-detail-color, var(--accent)); color: var(--text-on-accent); }
.session-editable-field-controls button:disabled { opacity: .55; cursor: default; }
.session-editable-field-spinner { animation: session-editable-field-spin .8s linear infinite; }
@keyframes session-editable-field-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .session-editable-field { transition: none; }.session-editable-field-spinner { animation: none; } }
</style>
