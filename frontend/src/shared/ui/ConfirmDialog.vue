<template>
  <AppModal :z-index="zIndex" :show-close="false" :dismissible="!loading" @close="$emit('cancel')">
    <div class="cd-title">{{ title }}</div>
    <div v-if="message" class="cd-message">{{ message }}</div>
    <div class="cd-actions">
      <button type="button" class="cd-btn-cancel" :disabled="loading" @click="$emit('cancel')">{{ cancelLabel }}</button>
      <button
        type="button"
        class="cd-btn-confirm"
        :class="`cd-btn--${variant}`"
        :disabled="loading"
        @click="$emit('confirm')"
      >{{ loading ? loadingLabel : confirmLabel }}</button>
    </div>
  </AppModal>
</template>

<script setup>
import AppModal from '@/shared/ui/AppModal.vue'

defineProps({
  title:        { type: String, required: true },
  message:      { type: String, default: '' },
  confirmLabel: { type: String, default: 'Подтвердить' },
  cancelLabel:  { type: String, default: 'Отмена' },
  loadingLabel: { type: String, default: 'Выполняется…' },
  loading:      { type: Boolean, default: false },
  variant:      { type: String, default: 'danger' },
  zIndex:       { type: Number, default: 5000 },
})
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.cd-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 8px;
}

.cd-message {
  font-size: 13px;
  color: var(--text-2);
  margin-bottom: 22px;
  line-height: 1.5;
}

.cd-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.cd-btn-cancel {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--border-strong);
  background: none;
  color: var(--text-2);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cd-btn-cancel:hover {
  background: var(--surface-raised);
  color: var(--text-1);
}

.cd-btn-confirm {
  padding: 8px 18px;
  border-radius: 8px;
  border: none;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.cd-btn--danger {
  background: color-mix(in srgb, var(--danger) 24%, var(--surface-raised));
  color: color-mix(in srgb, var(--danger) 42%, var(--text-on-accent));
}

.cd-btn--danger:hover {
  background: color-mix(in srgb, var(--danger) 36%, var(--surface-raised));
}

.cd-btn--warning {
  background: color-mix(in srgb, var(--warning) 20%, var(--surface-raised));
  color: color-mix(in srgb, var(--warning) 50%, var(--text-on-accent));
}

.cd-btn--warning:hover {
  background: color-mix(in srgb, var(--warning) 30%, var(--surface-raised));
}

.cd-btn-cancel:disabled,
.cd-btn-confirm:disabled {
  cursor: wait;
  opacity: 0.55;
}
</style>
