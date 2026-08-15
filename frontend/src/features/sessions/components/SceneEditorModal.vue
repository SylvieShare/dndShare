<template>
  <AppModalFrame extra-wide :title="scene ? 'Редактировать сценарий' : 'Новый сценарий'" @close="$emit('close')">
    <FormField label="Название" vertical>
      <FormTextInput v-model:value="draft.name" :maxlength="160" placeholder="Название сценария" autofocus @enter="submit" />
    </FormField>

    <div class="scene-image-section">
      <div class="scene-image-title">Изображение</div>
      <SessionImagePicker :model-value="draft.imagePresetKey" @select="draft.imagePresetKey = $event" />
    </div>

    <template #footer>
      <FormActionButtons
        :submit-text="scene ? 'Сохранить' : 'Создать сценарий'"
        loading-text="Сохранение…"
        :loading="saving"
        :can-submit="!!draft.name.trim() && !!draft.imagePresetKey"
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
import { FormTextInput } from '@sylvieshare/share-ui'
import SessionImagePicker from '@/features/sessions/components/SessionImagePicker.vue'

const props = defineProps({
  scene: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])

const draft = reactive({
  name: props.scene?.name ?? '',
  imagePresetKey: props.scene?.imagePresetKey ?? 'discovery',
})

function submit() {
  if (!draft.name.trim() || !draft.imagePresetKey || props.saving) return
  emit('save', { name: draft.name.trim(), imagePresetKey: draft.imagePresetKey })
}
</script>

<style scoped>
.scene-image-section { display: flex; flex-direction: column; gap: 10px; }
.scene-image-title { color: var(--text-2); font-size: 13px; font-weight: 600; }
</style>
