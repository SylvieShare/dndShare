<template>
  <AppModalFrame title="Редактировать сессию" @close="$emit('close')">
    <FormField label="Название" vertical>
      <FormTextInput v-model:value="name" :maxlength="255" autofocus @enter="save" />
    </FormField>
    <FormField label="Описание" vertical>
      <FormTextarea v-model:value="description" :rows="3" :maxlength="1000" />
    </FormField>
    <template #footer>
      <FormActionButtons
        submit-text="Сохранить"
        loading-text="Сохранение..."
        :loading="saving"
        :can-submit="!!name.trim()"
        @cancel="$emit('close')"
        @submit="save"
      />
    </template>
  </AppModalFrame>
</template>

<script setup>
import { ref } from 'vue'
import {
  AppModalFrame,
  FormActionButtons,
  FormField,
  FormTextInput,
  FormTextarea,
} from '@sylvieshare/share-ui'
import { updateSession } from '@/shared/api/sessionsApi'

const props = defineProps({
  session: { type: Object, required: true },
  sessionUuid: { type: String, required: true },
})
const emit = defineEmits(['close', 'saved'])
const name = ref(props.session.name || '')
const description = ref(props.session.description || '')
const saving = ref(false)

async function save() {
  if (!name.value.trim() || saving.value) return
  saving.value = true
  const data = { name: name.value.trim(), description: description.value.trim() || null }
  try {
    await updateSession(props.sessionUuid, data)
    emit('saved', data)
  } finally {
    saving.value = false
  }
}
</script>
