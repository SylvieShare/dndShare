<template>
  <div class="form-actions">
    <button
      type="button"
      class="form-actions__cancel"
      :disabled="disabled"
      @click="$emit('cancel')"
    >{{ cancelText }}</button>
    <button
      type="button"
      class="form-actions__submit"
      :disabled="disabled || loading || !canSubmit"
      @click="$emit('submit')"
    >{{ loading ? loadingText : submitText }}</button>
  </div>
</template>

<script setup>
defineProps({
  submitText:  { type: String, default: 'Сохранить' },
  cancelText:  { type: String, default: 'Отмена' },
  loadingText: { type: String, default: 'Сохранение...' },
  loading:     { type: Boolean, default: false },
  canSubmit:   { type: Boolean, default: true },
  disabled:    { type: Boolean, default: false },
})
defineEmits(['cancel', 'submit'])
</script>

<style scoped>
.form-actions {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
  padding-top: 4px;
}

.form-actions__cancel,
.form-actions__submit {
  font: inherit;
  font-size: 14px;
  padding: 9px 20px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}

.form-actions__cancel {
  background: none;
  border: 1px solid var(--border-strong);
  color: var(--text-2);
}
.form-actions__cancel:hover:not(:disabled) {
  background: var(--surface-raised);
  color: var(--text-1);
}

.form-actions__submit {
  background: var(--accent);
  border: none;
  color: var(--text-on-accent);
  font-weight: 600;
}
.form-actions__submit:hover:not(:disabled) { background: var(--accent-hover); }

.form-actions__cancel:disabled,
.form-actions__submit:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
