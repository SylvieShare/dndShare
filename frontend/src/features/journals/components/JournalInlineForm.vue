<template>
  <div class="journal-inline-form" role="form" :aria-label="label"
    @keydown.esc.stop.prevent="!busy && $emit('cancel')" @keydown.ctrl.enter.prevent="$emit('save')" @keydown.meta.enter.prevent="$emit('save')">
    <fieldset :disabled="busy" :inert="busy"><legend class="journal-inline-label">{{ label }}</legend><slot /></fieldset>
    <p v-if="error" role="alert">{{ error }}</p>
    <div class="journal-inline-actions"><slot name="actions" /><FormActionButtons :loading="busy" :disabled="busy" @submit="$emit('save')" @cancel="$emit('cancel')" /></div>
  </div>
</template>
<script setup>
import { FormActionButtons } from '@sylvieshare/share-ui'
defineProps({ label: String, busy: Boolean, error: String })
defineEmits(['save', 'cancel'])
</script>
<style scoped>
.journal-inline-form { min-width: 0; display: flex; flex-direction: column; gap: 12px; padding: 16px 0; }
.journal-inline-form fieldset { display: flex; flex-direction: column; min-width: 0; gap: 10px; border: 0; margin: 0; padding: 0; }
.journal-inline-label { margin-bottom: 10px; color: var(--text-muted); font-size: 11px; }
.journal-inline-form p { margin: 0; color: var(--danger); font-size: 12px; line-height: 1.6; }
.journal-inline-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; }
.journal-inline-actions :deep(.form-actions) { margin-left: auto; }
@media (max-width: 720px) { .journal-inline-actions :deep(button) { padding: 8px 12px; font-size: 12px; } }
</style>
