<template>
  <MorphTile :embedded="panel" padding="0" edit-label="Редактировать" :title="level > 0 ? 'Истощение' : 'Истощения нет'" :show-edit="editable" @edit="$emit('edit', $event)" class="exh-view" :class="{ 'exh-view--panel': panel }">
    <template #decoration><slot name="decoration" /></template>
    <template #aside><span v-if="level > 0" class="exh-value exh-value--on">{{ valueText }}</span></template>
    <ul v-if="level > 0" class="exh-lines">
      <li v-for="(eff, i) in activeEffects" :key="i">{{ eff }}</li>
    </ul>
  </MorphTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
defineProps({
  panel: Boolean,
  level: { type: Number, default: 0 },
  valueText: { type: String, default: '' },
  activeEffects: { type: Array, default: () => [] },
  editable: { type: Boolean, default: false },
})
defineEmits(['edit'])
</script>

<style scoped>
.exh-view {
  min-height: 42px;
  padding: 10px 12px 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.exh-view--panel { padding-right: 14px; }
.exh-value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
}
.exh-value--on { color: var(--danger); }

.exh-lines {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.exh-lines li {
  position: relative;
  padding-left: 12px;
  font-size: 12px;
  line-height: 1.35;
  color: var(--text-2);
}
.exh-lines li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--danger);
}
</style>
