<template>
  <div class="ds-row"><span class="ds-label">При смерти</span><span class="ds-counts">(✓ {{hp.ds_success || 0}} / ✕ {{hp.ds_failure || 0}})</span>
    <button v-if="editable" type="button" class="ds-revive" title="Воскресить игрока" aria-label="Воскресить игрока" @click.stop="$emit('revive')"><HeartPulse :size="14" /></button>
  </div>
</template>
<script setup>
import { HeartPulse } from '@lucide/vue'
defineProps({hp:{type:Object,required:true},editable:Boolean})
defineEmits(['revive'])
</script>
<style scoped>
.ds-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.ds-label {
  font-size: 10px;
  color: var(--danger);
  font-weight: 600;
  letter-spacing: 0.03em;
  flex-shrink: 0;
}

.ds-counts { overflow: hidden; color: var(--text-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }

.ds-revive {
  width: 24px;
  height: 24px;
  display: grid;
  flex: 0 0 24px;
  place-items: center;
  margin-left: auto;
  padding: 0;
  border: 1px solid color-mix(in srgb, var(--success) 42%, var(--border));
  border-radius: 7px;
  background: color-mix(in srgb, var(--success) 11%, transparent);
  color: var(--success);
  cursor: pointer;
}

.ds-revive:hover { border-color: var(--success); background: color-mix(in srgb, var(--success) 18%, transparent); }
</style>
