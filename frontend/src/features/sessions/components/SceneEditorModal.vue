<template>
  <AppModalFrame extra-wide :title="scene ? 'Редактировать сценарий' : 'Новый сценарий'" @close="$emit('close')">
    <div class="scene-editor-main-grid">
      <FormField label="Название" vertical>
        <FormTextInput v-model:value="draft.name" :maxlength="160" placeholder="Название сценария" autofocus @enter="submit" />
      </FormField>
      <FormField label="Статус" vertical>
        <FormSelect v-model:value="draft.status">
          <option v-for="status in SCENE_STATUSES" :key="status.key" :value="status.key">{{ status.label }}</option>
        </FormSelect>
      </FormField>
    </div>

    <div class="scene-image-section">
      <div class="scene-image-title">Изображение</div>
      <SessionImagePicker :model-value="draft.imageId" default-key="discovery" :current-url="scene?.imageUrl || ''" @select="draft.imageId = $event.id" />
    </div>

    <template #footer>
      <FormActionButtons
        :submit-text="scene ? 'Сохранить' : 'Создать сценарий'"
        loading-text="Сохранение…"
        :loading="saving"
        :can-submit="!!draft.name.trim() && !!draft.imageId"
        @cancel="$emit('close')"
        @submit="submit"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { reactive } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormSelect } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'
import { SCENE_STATUSES } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  scene: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])
const draft = reactive({
  name: props.scene?.name ?? '',
  status: props.scene?.status ?? 'none',
  imageId: props.scene?.imageId ?? 0,
})

function submit() {
  if (!draft.name.trim() || !draft.imageId || props.saving) return
  emit('save', {
    name: draft.name.trim(), status: draft.status, imageId: draft.imageId,
  })
}
</script>

<style scoped>
.scene-editor-main-grid { display: grid; grid-template-columns: minmax(0, 1fr) 210px; gap: 14px; }
.scene-image-section { display: flex; flex-direction: column; gap: 10px; }
.scene-image-title { color: var(--text-2); font-size: 13px; font-weight: 600; }
@media (max-width: 640px) { .scene-editor-main-grid { grid-template-columns: 1fr; } }
</style>
