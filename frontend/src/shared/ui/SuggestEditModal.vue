<template>
  <AppModalFrame :title="isEdit ? 'Редактировать' : 'Новый вариант'" :z-index="zIndex" wide @close="$emit('close')">

    <!-- Preview -->
    <div class="sem-preview">
      <div
        class="preview-icon"
        :style="form.color ? { background: form.color + '22', borderColor: form.color + '55', color: form.color } : {}"
      >
        <span v-if="svgPreviewText || form.svg" class="preview-icon-svg" v-html="svgPreviewText || form.svg"></span>
        <span v-else class="preview-icon-placeholder">{{ (form.value || '?')[0]?.toUpperCase() }}</span>
      </div>
      <div class="preview-body">
        <div class="preview-name-row">
          <span class="preview-name">{{ form.value || '—' }}</span>
          <span v-if="form.code" class="preview-code">{{ form.code }}</span>
        </div>
        <div
          v-if="form.color"
          class="preview-color-badge"
          :style="{ background: form.color + '22', color: form.color, borderColor: form.color + '55' }"
        >{{ form.color }}</div>
      </div>
    </div>

    <FormField label="NAME" hint="отображаемое" vertical>
      <FormTextInput
        ref="nameInput"
        v-model:value="form.value"
        placeholder="Название..."
        @enter="save"
      />
    </FormField>

    <FormField label="CODE" hint="системный ключ" vertical>
      <FormTextInput v-model:value="form.code" mono placeholder="en_key..." />
    </FormField>

    <FormField label="COLOR" vertical>
      <ColorPresetPicker inline allow-custom allow-clear clear-value="" :model-value="form.color || ''" @update:model-value="v => form.color = v" />
    </FormField>

    <FormField label="SVG" hint="значок" vertical>
      <div class="sem-svg-row">
        <div v-if="svgPreviewText || form.svg" class="sem-svg-preview" v-html="svgPreviewText || form.svg"></div>
        <div class="sem-svg-actions">
          <button class="sem-svg-upload-btn" :disabled="uploadingSvg" @click="svgFileInput.click()">
            {{ uploadingSvg ? 'Загрузка...' : 'Загрузить SVG' }}
          </button>
          <button v-if="svgPreviewText || form.svg" class="sem-svg-clear-btn" :disabled="uploadingSvg" @click="clearSvg">Удалить</button>
        </div>
        <input ref="svgFileInput" type="file" accept="image/svg+xml,.svg" style="display:none" @change="onSvgFileChange" />
      </div>
    </FormField>

    <FormField label="DESCRIPTION" vertical>
      <div class="sem-desc-wrap">
        <InputDescription
          editable
          :block="descBlock"
          :value="form.desc"
          @update:value="(_id, v) => form.desc = v"
        />
      </div>
    </FormField>

    <template #footer>
      <FormActionButtons
        :submit-text="isEdit ? 'Сохранить' : 'Добавить'"
        loading-text="Сохранение..."
        :loading="saving"
        :can-submit="canSubmit"
        @cancel="$emit('close')"
        @submit="save"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { computed, nextTick, onMounted, reactive, ref } from 'vue'
import AppModalFrame from '@/shared/ui/AppModalFrame.vue'
import ColorPresetPicker from '@/shared/ui/ColorPresetPicker'
import FormActionButtons from '@/shared/ui/form/FormActionButtons'
import FormField from '@/shared/ui/form/FormField'
import FormTextInput from '@/shared/ui/form/FormTextInput'
import InputDescription from '@/shared/ui/InputDescription'
import { fetchPost, fetchPut } from '@/shared/api/http'

const props = defineProps({
  typeId: { type: [Number, String], required: true },
  item: { type: Object, default: null },
  initialName: { type: String, default: '' },
  zIndex: { type: Number, default: 3000 },
})

const emit = defineEmits(['close', 'saved', 'created'])

const isEdit = computed(() => !!props.item)

const nameInput = ref(null)
const svgFileInput = ref(null)
const saving = ref(false)
const uploadingSvg = ref(false)
const svgFile = ref(null)
const svgPreviewText = ref('')

const form = reactive({
  value: props.item?.value || props.initialName || '',
  code: props.item?.code || '',
  color: props.item?.color || '',
  svg: props.item?.svg || '',
  desc: props.item?.desc || '',
})

const descBlock = { id: 'desc', content: { placeholder: 'Описание...' } }
const canSubmit = computed(() => form.value.trim().length > 0)

onMounted(() => nextTick(() => nameInput.value?.focus?.()))

function clearSvg() {
  svgFile.value = null
  svgPreviewText.value = ''
  form.svg = ''
}

function onSvgFileChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  svgFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => { svgPreviewText.value = ev.target.result }
  reader.readAsText(file)
}

function basePayload() {
  return {
    value: form.value.trim(),
    code: form.code.trim() || null,
    color: form.color || null,
    desc: form.desc?.trim() ? form.desc : null,
  }
}

async function save() {
  if (!canSubmit.value || saving.value) return
  saving.value = true
  try {
    let result
    if (isEdit.value) {
      result = await fetchPut('/suggest/' + props.typeId + '/' + props.item.id, basePayload())
    } else {
      result = await fetchPost('/suggest/' + props.typeId, basePayload())
    }

    if (svgFile.value && result?.id) {
      const fd = new FormData()
      fd.append('file', svgFile.value)
      uploadingSvg.value = true
      try {
        const res = await fetch('/api/suggest/' + props.typeId + '/' + result.id + '/svg', { method: 'POST', body: fd })
        if (res.ok) {
          const data = await res.json()
          result = await fetchPut('/suggest/' + props.typeId + '/' + result.id, {
            ...basePayload(),
            svgId: data.svg_id ?? data.upload_id,
            svg: data.url,
            svgChanged: true,
          })
        }
      } catch { /* SVG upload failed silently */ } finally {
        uploadingSvg.value = false
      }
    }

    emit(isEdit.value ? 'saved' : 'created', result)
    emit('close')
  } catch { /* server error swallowed */ } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.sem-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: color-mix(in srgb, var(--text-on-accent) 2.5%, transparent);
  border-radius: var(--r-md);
  border: 1px solid var(--border);
}
.preview-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 6%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 9%, transparent);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.preview-icon-svg {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  color: currentColor;
}
.preview-icon-svg :deep(svg) { width: 28px; height: 28px; }
.preview-icon-placeholder { font-size: 18px; font-weight: 700; color: currentColor; }

.preview-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.preview-name-row { display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
.preview-name { font-size: 15px; font-weight: 600; color: var(--text-1); }
.preview-code { font-size: 11px; color: var(--text-muted); font-family: monospace; }
.preview-color-badge {
  align-self: flex-start;
  font-size: 11px;
  font-family: monospace;
  border-radius: var(--r-xs);
  padding: 2px 7px;
  border: 1px solid transparent;
}

.sem-svg-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.sem-svg-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--text-on-accent) 5%, transparent);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.sem-svg-preview :deep(svg) { width: 26px; height: 26px; }

.sem-svg-actions { display: flex; gap: 8px; align-items: center; }
.sem-svg-upload-btn {
  border: 1px dashed var(--border);
  background: none;
  color: var(--text-2);
  border-radius: 7px;
  padding: 5px 12px;
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.sem-svg-upload-btn:hover { color: var(--text-1); border-color: var(--accent); }
.sem-svg-upload-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.sem-svg-clear-btn {
  border: none;
  background: none;
  color: var(--danger);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  padding: 5px 8px;
}
.sem-svg-clear-btn:hover { color: color-mix(in srgb, var(--danger) 80%, var(--text-on-accent)); }

.sem-desc-wrap {
  background: color-mix(in srgb, var(--text-on-accent) 4%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  border-radius: 8px;
  padding: 8px 12px;
  min-height: 80px;
}
</style>
