<template>
  <AppModalFrame :title="title" @close="$emit('close')">
    <FormField label="Подпись на линии" vertical>
      <FormTextInput
        v-model:value="label"
        :maxlength="240"
        placeholder="Например: если герои согласились помочь"
        autofocus
        @enter="submit"
      />
    </FormField>
    <p class="edge-modal-hint">Подпись необязательна — переход можно оставить без условия.</p>
    <template #footer>
      <FormActionButtons
        submit-text="Сохранить переход"
        loading-text="Сохранение…"
        :loading="saving"
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

const props = defineProps({
  edge: { type: Object, default: null },
  title: { type: String, default: 'Новый переход' },
  saving: { type: Boolean, default: false },
})
const emit = defineEmits(['close', 'save'])
const label = ref(props.edge?.label ?? '')

function submit() {
  if (props.saving) return
  emit('save', label.value.trim() || null)
}
</script>

<style scoped>
.edge-modal-hint {
  margin: 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.45;
}
</style>
