<template>
  <AppModal :z-index="zIndex" :show-close="false" :dismissible="!loading" @close="cancel">
    <div class="tpd-title">{{ title }}</div>
    <div v-if="message" class="tpd-message">{{ message }}</div>
    <FormTextInput
      :value="draft"
      :placeholder="placeholder"
      :maxlength="maxlength"
      autofocus
      @update:value="draft = $event"
      @enter="submit"
    />
    <FormActionButtons
      :submit-text="confirmLabel"
      :cancel-text="cancelLabel"
      :loading-text="loadingLabel"
      :loading="loading"
      :can-submit="!!draft.trim()"
      @cancel="cancel"
      @submit="submit"
    />
  </AppModal>
</template>

<script setup>
import { ref, watch } from 'vue'
import AppModal from '@/shared/ui/AppModal.vue'
import FormActionButtons from '@/shared/ui/form/FormActionButtons.vue'
import FormTextInput from '@/shared/ui/form/FormTextInput.vue'

const props = defineProps({
  title: { type: String, required: true },
  message: { type: String, default: '' },
  value: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  maxlength: { type: Number, default: 255 },
  confirmLabel: { type: String, default: 'Сохранить' },
  cancelLabel: { type: String, default: 'Отмена' },
  loadingLabel: { type: String, default: 'Сохранение…' },
  loading: { type: Boolean, default: false },
  zIndex: { type: Number, default: 5000 },
})
const emit = defineEmits(['confirm', 'cancel'])
const draft = ref(props.value)

watch(() => props.value, value => { draft.value = value })

function cancel() {
  if (!props.loading) emit('cancel')
}

function submit() {
  const value = draft.value.trim()
  if (value && !props.loading) emit('confirm', value)
}
</script>

<style scoped>
.tpd-title {
  color: var(--text-1);
  font-size: 16px;
  font-weight: 700;
}

.tpd-message {
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.5;
}
</style>
