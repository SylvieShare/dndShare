<template>
  <Teleport to="body">
    <div class="cd-overlay" @click.self="$emit('cancel')">
      <div class="cd-dialog">
        <div class="cd-title">{{ title }}</div>
        <div v-if="message" class="cd-message">{{ message }}</div>
        <div class="cd-actions">
          <button class="cd-btn-cancel" @click="$emit('cancel')">{{ cancelLabel }}</button>
          <button class="cd-btn-confirm" :class="`cd-btn--${variant}`" @click="$emit('confirm')">
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  title:        { type: String, required: true },
  message:      { type: String, default: '' },
  confirmLabel: { type: String, default: 'Подтвердить' },
  cancelLabel:  { type: String, default: 'Отмена' },
  variant:      { type: String, default: 'danger' },
})
defineEmits(['confirm', 'cancel'])
</script>

<style scoped>
.cd-overlay {
  position: fixed;
  inset: 0;
  background: var(--scrim);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.cd-dialog {
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: 16px;
  padding: 26px 26px 20px;
  min-width: 280px;
  max-width: 360px;
  box-shadow: var(--shadow-lg);
}

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
</style>
