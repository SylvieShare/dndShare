<template>
  <div class="journal-inline-form" role="form" :aria-label="label"
    @keydown.esc.stop.prevent="!busy && $emit('cancel')" @keydown.ctrl.enter.prevent="$emit('save')" @keydown.meta.enter.prevent="$emit('save')">
    <fieldset :disabled="busy" :inert="busy"><legend class="journal-inline-label">{{ label }}</legend><div class="journal-inline-fields"><slot /></div></fieldset>
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
.journal-inline-form { min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; }
.journal-inline-form fieldset { min-width: 0; border: 0; margin: 0; padding: 0; }
.journal-inline-fields { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
.journal-inline-label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.journal-inline-form p { margin: 0; color: var(--danger); font-size: 12px; line-height: 1.6; }
.journal-inline-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border); padding-top: 12px; }
.journal-inline-actions :deep(.form-actions) { margin-left: auto; }
</style>
