<template>
  <div class="form-field" :class="{ 'form-field--vertical': vertical }">
    <span class="form-field-label">{{ label }}<span v-if="hint" class="form-field-hint">{{ hint }}</span></span>
    <slot />
  </div>
</template>

<script setup>
defineProps({
  label: { type: String, required: true },
  vertical: { type: Boolean, default: false },
  hint: { type: String, default: '' },
})
</script>

<style scoped>
.form-field {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
}

.form-field-label {
  flex: 1;
  color: var(--text-2);
  font-size: 13px;
}

.form-field--vertical {
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}

.form-field--vertical .form-field-label {
  flex: none;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-muted);
  text-transform: uppercase;
}

.form-field-hint {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 400;
  letter-spacing: 0.04em;
  text-transform: none;
  margin-left: 6px;
}
</style>
