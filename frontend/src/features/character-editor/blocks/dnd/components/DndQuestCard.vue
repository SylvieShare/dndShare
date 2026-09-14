<template>
  <MorphTile :embedded="panel" padding="0" edit-label="Редактировать" :title="quest.title || 'Без названия'" :show-edit="editable" @edit="$emit('edit', $event)" class="dqc" :style="{ '--qc': meta.color }">
    <template #decoration><slot name="decoration" /></template>
    <template #aside><span class="dqc-chip"><span class="dqc-dot"></span>{{ meta.label }}</span></template>
    <div v-if="quest.desc" class="dqc-desc">{{ quest.desc }}</div>
    <div v-if="quest.reward" class="dqc-reward">
      <span class="dqc-reward-icon" aria-hidden="true">✦</span>
      <div class="dqc-reward-body">
        <span class="dqc-reward-label">Награда</span>
        <span class="dqc-reward-text">{{ quest.reward }}</span>
      </div>
    </div>
  </MorphTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import { computed } from 'vue'
import { questStatusMeta } from '@/features/character-editor/blocks/dnd/lib/questEntry'

const props = defineProps({
  panel: Boolean,
  editable: { type: Boolean, default: false },
  quest: { type: Object, required: true },
})

const meta = computed(() => questStatusMeta(props.quest.status))
defineEmits(['edit'])
</script>

<style scoped>
.dqc {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 13px 16px 14px;
  min-width: 0;
  box-sizing: border-box;
}



.dqc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--qc) 75%, var(--text-2));
  background: color-mix(in srgb, var(--qc) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--qc) 28%, transparent);
  border-radius: var(--r-pill);
  padding: 3px 9px;
}
.dqc-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--qc);
}

.dqc-desc {
  font-size: 13px;
  line-height: 1.45;
  color: var(--text-2);
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.dqc-reward {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-top: 2px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--warning) 28%, var(--border));
  border-radius: 9px;
  background: linear-gradient(135deg,
    color-mix(in srgb, var(--warning) 10%, transparent),
    color-mix(in srgb, var(--warning) 3%, transparent));
}
.dqc-reward-icon {
  flex-shrink: 0;
  color: var(--warning);
  line-height: 1.3;
}
.dqc-reward-body {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.dqc-reward-label {
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--warning) 72%, var(--text-2));
}
.dqc-reward-text {
  font-size: 12.5px;
  line-height: 1.4;
  color: var(--text-1);
  white-space: pre-line;
  overflow-wrap: anywhere;
}
</style>
