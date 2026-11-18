<template>
  <div class="ds-row">
    <component :is="canEdit ? 'button' : 'span'" class="ds-info" :type="canEdit ? 'button' : undefined"
               :aria-label="label" :title="label" @click.stop="canEdit && $emit('edit')">
      <span class="ds-label">{{ red ? 'Проверка смерти' : 'Спасброски' }}</span>
      <span v-if="red" class="ds-counts" aria-hidden="true">d10</span>
      <span v-else class="ds-counts" aria-hidden="true"><span class="ds-success">✓ {{ hp.ds_success || 0 }}</span> / <span class="ds-failure">✕ {{ hp.ds_failure || 0 }}</span></span>
    </component>
    <button v-if="editable" type="button" class="ds-revive" title="Воскресить игрока" aria-label="Воскресить игрока" @click.stop="$emit('revive')"><HeartPulse :size="14" /></button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { HeartPulse } from '@lucide/vue'
const props = defineProps({ hp: { type: Object, required: true }, editable: Boolean, canEdit: Boolean, red: Boolean })
defineEmits(['edit', 'revive'])
const label = computed(() => props.red
  ? 'Проверка смерти, d10'
  : `Спасброски от смерти: успехов ${props.hp.ds_success || 0}, провалов ${props.hp.ds_failure || 0}`)
</script>

<style scoped>
.ds-row { display: flex; align-items: center; gap: var(--spacing-xs); flex-wrap: wrap; }
.ds-info, .ds-revive {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
  gap: var(--spacing-xs);
  min-block-size: var(--layout-touch-min);
  border: 0;
  border-radius: var(--radius-input);
  background: transparent;
}
.ds-info { padding-inline: var(--spacing-xs); color: var(--text-muted); font: inherit; font-size: var(--type-context-size); }
.ds-label { color: var(--text-2); }
.ds-counts { font-variant-numeric: tabular-nums; white-space: nowrap; }
.ds-success, .ds-revive { color: var(--success); }
.ds-failure { color: var(--danger); }
.ds-revive { min-inline-size: var(--layout-touch-min); padding: 0; }
button.ds-info, .ds-revive { cursor: pointer; }
button.ds-info:hover, .ds-revive:hover { background: var(--surface-active); }
</style>
