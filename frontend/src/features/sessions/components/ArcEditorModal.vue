<template>
  <AppModalFrame :title="arc ? 'Редактировать арку' : 'Новая арка'" @close="$emit('close')">
    <FormField label="Название" vertical>
      <FormTextInput v-model:value="name" :maxlength="160" autofocus @enter="submit" />
    </FormField>
    <FormField label="Описание" vertical>
      <FormTextarea v-model:value="description" :rows="4" :maxlength="1000" placeholder="Необязательное описание арки" />
    </FormField>
    <template #footer>
      <div class="arc-editor-footer">
        <button v-if="arc" type="button" class="arc-editor-delete" :disabled="saving" @click="$emit('delete', arc)">
          Удалить арку
        </button>
        <FormActionButtons
          :submit-text="arc ? 'Сохранить' : 'Создать арку'"
          loading-text="Сохранение…"
          :loading="saving"
          :can-submit="!!name.trim()"
          @cancel="$emit('close')"
          @submit="submit"
        />
      </div>
    </template>
  </AppModalFrame>
</template>

<script setup>
import { ref } from 'vue'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { FormActionButtons } from '@sylvieshare/share-ui'
import { FormField } from '@sylvieshare/share-ui'
import { FormTextInput } from '@sylvieshare/share-ui'
import { FormTextarea } from '@sylvieshare/share-ui'

const props = defineProps({
  arc: { type: Object, default: null },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save', 'delete'])

const name = ref(props.arc?.name ?? '')
const description = ref(props.arc?.description ?? '')

function submit() {
  if (!name.value.trim() || props.saving) return
  emit('save', { name: name.value.trim(), description: description.value.trim() || null })
}
</script>

<style scoped>
.arc-editor-footer { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.arc-editor-delete { margin-top: 4px; padding: 9px 0; border: 0; background: none; color: var(--danger); font: inherit; font-size: 13px; cursor: pointer; }
.arc-editor-delete:hover:not(:disabled) { text-decoration: underline; }
.arc-editor-delete:disabled { opacity: 0.4; cursor: not-allowed; }

@media (max-width: 520px) {
  .arc-editor-footer { align-items: stretch; flex-direction: column-reverse; gap: 8px; }
  .arc-editor-delete { align-self: flex-start; }
}
</style>
