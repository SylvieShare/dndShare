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
  background: rgba(0, 0, 0, 0.62);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}

.cd-dialog {
  background: #1c1c2a;
  border: 1px solid var(--input-border);
  border-radius: 16px;
  padding: 26px 26px 20px;
  min-width: 280px;
  max-width: 360px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.7);
}

.cd-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-1);
  margin-bottom: 8px;
}

.cd-message {
  font-size: 13px;
  color: #9090b0;
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
  border: 1px solid var(--input-border);
  background: none;
  color: #9090b0;
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.cd-btn-cancel:hover {
  background: #242438;
  color: var(--text-2);
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
  background: #7a1c1c;
  color: #ffc8c8;
}

.cd-btn--danger:hover {
  background: #9a2222;
}

.cd-btn--warning {
  background: #5a3a10;
  color: #ffd8a0;
}

.cd-btn--warning:hover {
  background: #7a4f18;
}
</style>
