<template>
  <AppModalFrame :title="arc ? 'Редактировать арку' : 'Новая арка'" @close="$emit('close')">
    <FormField label="Название" vertical>
      <FormTextInput v-model:value="name" :maxlength="160" autofocus @enter="submit" />
    </FormField>
    <FormField label="Описание" vertical>
      <FormTextarea v-model:value="description" :rows="4" :maxlength="1000" placeholder="Необязательное описание арки" />
    </FormField>
    <template #footer>
      <FormActionButtons
        :submit-text="arc ? 'Сохранить' : 'Создать арку'"
        loading-text="Сохранение…"
        :loading="saving"
        :can-submit="!!name.trim()"
        @cancel="$emit('close')"
        @submit="submit"
      />
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
const emit = defineEmits(['close', 'save'])

const name = ref(props.arc?.name ?? '')
const description = ref(props.arc?.description ?? '')

function submit() {
  if (!name.value.trim() || props.saving) return
  emit('save', { name: name.value.trim(), description: description.value.trim() || null })
}
</script>
