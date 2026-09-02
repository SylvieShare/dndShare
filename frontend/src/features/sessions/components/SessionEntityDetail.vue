<template>
  <main
    class="session-world-detail session-entity-detail"
    :class="{ 'session-entity-detail--cover': coverUrl }"
    :style="detailStyle"
  >
    <header class="session-entity-detail-head">
      <div v-if="$slots.visual" class="session-entity-detail-visual">
        <slot name="visual" />
      </div>

      <div class="session-entity-detail-heading">
        <button v-if="backLabel" type="button" class="session-entity-detail-back" @click="$emit('back')">
          <ArrowLeft :size="13" />{{ backLabel }}
        </button>
        <div v-if="$slots.context" class="session-entity-detail-context"><slot name="context" /></div>
        <div class="session-entity-detail-eyebrow"><slot name="eyebrow">{{ eyebrow }}</slot></div>
        <div class="session-entity-detail-title-row">
          <template v-if="titleEditing">
            <input
              ref="titleInput"
              v-model="titleDraft"
              type="text"
              maxlength="160"
              :disabled="saving"
              @keydown.enter.prevent="saveTitle"
              @keydown.esc.prevent="cancelTitle"
            />
            <button type="button" :disabled="saving" aria-label="Отменить изменение названия" @click="cancelTitle"><X :size="15" /></button>
            <button type="button" class="primary" :disabled="saving || !titleDraft.trim()" aria-label="Сохранить название" @click="saveTitle"><Check :size="15" /></button>
          </template>
          <template v-else>
            <h2>{{ title }}</h2>
            <button
              v-if="titleEditable"
              type="button"
              class="session-entity-detail-title-edit"
              aria-label="Редактировать название"
              title="Редактировать название"
              @click="openTitle"
            ><Pencil :size="14" /></button>
          </template>
        </div>
        <div v-if="$slots.summary" class="session-entity-detail-summary"><slot name="summary" /></div>
        <div v-if="$slots.meta" class="session-entity-detail-meta"><slot name="meta" /></div>
      </div>

      <div v-if="editable || $slots['actions-before'] || $slots['actions-after']" class="session-entity-detail-actions">
        <slot name="actions-before" />
        <button v-if="editable" type="button" class="session-entity-detail-edit" :aria-label="editAriaLabel" @click="$emit('edit')">
          <Pencil :size="15" />Редактировать
        </button>
        <slot name="actions-after" />
      </div>
    </header>

    <div class="session-world-detail-scroll">
      <slot />
    </div>
  </main>
</template>

<script setup>
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowLeft, Check, Pencil, X } from '@lucide/vue'

const props = defineProps({
  title: { type: String, required: true },
  eyebrow: { type: String, default: '' },
  accent: { type: String, default: 'var(--accent)' },
  coverUrl: { type: String, default: '' },
  editable: { type: Boolean, default: false },
  titleEditable: { type: Boolean, default: false },
  saving: { type: Boolean, default: false },
  backLabel: { type: String, default: '' },
  editAriaLabel: { type: String, default: 'Редактировать объект' },
})

const emit = defineEmits(['edit', 'save-title', 'back'])
const titleEditing = ref(false)
const titleDraft = ref(props.title)
const titleInput = ref(null)

watch(() => props.title, value => {
  if (!titleEditing.value) titleDraft.value = value
})

function openTitle() {
  titleDraft.value = props.title
  titleEditing.value = true
  nextTick(() => titleInput.value?.focus())
}
function cancelTitle() {
  titleEditing.value = false
  titleDraft.value = props.title
}
function saveTitle() {
  const value = titleDraft.value.trim()
  if (!value || props.saving) return
  emit('save-title', value)
  titleEditing.value = false
}

const detailStyle = computed(() => ({
  '--entity-detail-color': props.accent,
  '--entity-detail-cover': props.coverUrl ? `url(${props.coverUrl})` : 'none',
}))
</script>

<style scoped>
.session-entity-detail-head { position: relative; min-height: 172px; display: flex; flex: none; align-items: center; gap: 20px; overflow: hidden; padding: 24px 28px; background: radial-gradient(circle at 12% 24%, color-mix(in srgb, var(--entity-detail-color) 19%, transparent), transparent 34%), linear-gradient(120deg, color-mix(in srgb, var(--entity-detail-color) 7%, var(--surface)), var(--surface) 68%); }
.session-entity-detail--cover .session-entity-detail-head { background-image: linear-gradient(90deg, color-mix(in srgb, var(--surface) 94%, transparent), color-mix(in srgb, var(--surface) 80%, transparent) 58%, color-mix(in srgb, var(--surface) 46%, transparent)), var(--entity-detail-cover); background-position: center; background-size: cover; }
.session-entity-detail-head::after { position: absolute; right: 0; bottom: 0; left: 0; height: 2px; background: linear-gradient(90deg, var(--entity-detail-color), transparent 74%); content: ''; }
.session-entity-detail-visual { position: relative; z-index: 1; width: 104px; height: 104px; display: grid; flex: none; place-items: center; overflow: hidden; border: 1px solid color-mix(in srgb, var(--entity-detail-color) 52%, var(--border)); border-radius: 22px; background: color-mix(in srgb, var(--entity-detail-color) 12%, var(--surface-raised)); color: var(--entity-detail-color); box-shadow: 0 14px 35px color-mix(in srgb, var(--bg) 30%, transparent); }
.session-entity-detail-visual :deep(img), .session-entity-detail-visual :deep(video) { width: 100%; height: 100%; display: block; object-fit: cover; }
.session-entity-detail-heading { position: relative; z-index: 1; min-width: 0; display: flex; flex: 1; flex-direction: column; align-items: flex-start; gap: 6px; }
.session-entity-detail-back { min-height: 26px; display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 4px 7px 4px 5px; border: 1px solid color-mix(in srgb, var(--entity-detail-color) 36%, var(--border)); border-radius: 7px; background: color-mix(in srgb, var(--surface-raised) 70%, transparent); color: var(--text-2); font: inherit; font-size: 9px; cursor: pointer; backdrop-filter: blur(8px); }
.session-entity-detail-back:hover { border-color: color-mix(in srgb, var(--entity-detail-color) 62%, var(--border)); color: var(--text-1); }
.session-entity-detail-context { min-height: 13px; }
.session-entity-detail-eyebrow { display: flex; align-items: center; gap: 6px; color: color-mix(in srgb, var(--entity-detail-color) 78%, var(--text-1)); font-size: 9px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
.session-entity-detail-title-row { min-width: 0; max-width: 760px; display: flex; align-items: center; gap: 7px; }
.session-entity-detail-heading h2 { min-width: 0; max-width: 720px; margin: 0; overflow: hidden; color: var(--text-1); font-family: var(--font-display); font-size: clamp(27px, 3vw, 38px); font-weight: 700; line-height: 1.08; text-overflow: ellipsis; white-space: nowrap; }
.session-entity-detail-title-row > button { width: 31px; height: 31px; display: grid; flex: none; place-items: center; padding: 0; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-raised) 78%, transparent); color: var(--text-muted); cursor: pointer; }
.session-entity-detail-title-row > button:hover:not(:disabled) { border-color: color-mix(in srgb, var(--entity-detail-color) 54%, var(--border)); color: var(--text-1); }
.session-entity-detail-title-row > button.primary { border-color: var(--entity-detail-color); background: var(--entity-detail-color); color: var(--text-on-accent); }
.session-entity-detail-title-edit { opacity: 0; transition: opacity .15s; }
.session-entity-detail-title-row:hover .session-entity-detail-title-edit, .session-entity-detail-title-edit:focus-visible { opacity: 1; }
.session-entity-detail-title-row input { box-sizing: border-box; width: min(560px, 62vw); min-height: 43px; padding: 6px 10px; border: 1px solid var(--entity-detail-color); border-radius: 9px; outline: 0; background: color-mix(in srgb, var(--surface) 88%, transparent); color: var(--text-1); font: 700 clamp(22px, 2.6vw, 32px)/1.1 var(--font-display); box-shadow: 0 0 0 3px color-mix(in srgb, var(--entity-detail-color) 14%, transparent); }
.session-entity-detail-summary { max-width: 680px; color: var(--text-2); font-size: 11px; line-height: 1.45; }
.session-entity-detail-meta { display: flex; flex-wrap: wrap; gap: 8px 14px; color: var(--text-muted); font-size: 9px; }
.session-entity-detail-meta :deep(span) { display: inline-flex; align-items: center; gap: 4px; }
.session-entity-detail-actions { position: relative; z-index: 1; display: flex; flex: none; flex-wrap: wrap; justify-content: flex-end; align-self: flex-start; gap: 7px; }
.session-entity-detail-actions :deep(button) { min-height: 34px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: color-mix(in srgb, var(--surface-raised) 82%, transparent); color: var(--text-1); font: inherit; font-size: 10px; font-weight: 650; white-space: nowrap; cursor: pointer; backdrop-filter: blur(8px); }
.session-entity-detail-actions :deep(button:hover) { border-color: color-mix(in srgb, var(--entity-detail-color) 48%, var(--border)); background: color-mix(in srgb, var(--entity-detail-color) 9%, var(--surface-raised)); }
.session-entity-detail-actions :deep(button.primary) { border-color: color-mix(in srgb, var(--entity-detail-color) 72%, var(--border)); background: var(--entity-detail-color); color: var(--text-on-accent); }
.session-entity-detail-actions :deep(button.danger) { color: var(--danger); }
.session-entity-detail-edit { flex: none; }

@media (max-width: 900px) {
  .session-entity-detail-head { min-height: 154px; gap: 15px; padding: 20px; }
  .session-entity-detail-visual { width: 84px; height: 84px; border-radius: 18px; }
  .session-entity-detail-actions :deep(button) { width: 34px; padding: 0; }
  .session-entity-detail-actions :deep(button) { font-size: 0; gap: 0; }
}

@media (hover: none) { .session-entity-detail-title-edit { opacity: 1; } }

@media (max-width: 620px) {
  .session-entity-detail-head { align-items: flex-start; flex-wrap: wrap; }
  .session-entity-detail-heading { min-width: calc(100% - 104px); }
  .session-entity-detail-actions { width: 100%; justify-content: flex-start; }
}
</style>
