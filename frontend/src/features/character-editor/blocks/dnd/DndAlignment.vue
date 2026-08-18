<template>
  <div class="alignment-row">
    <span class="alignment-label">{{ block.title }}</span>
    <DndAlignmentPicker
      class="alignment-control"
      :model-value="value"
      :editable="owner"
      :placeholder="block.content?.placeholder || 'Мировоззрение'"
      @update:model-value="$emit('update:value', block.id, $event)"
    />
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import DndAlignmentPicker from '@/shared/ui/DndAlignmentPicker.vue'

defineProps({ block: { type: Object, required: true }, value: { type: String, default: '' } })
defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: true })
const owner = computed(() => !!charCtx.ownerMode)
</script>

<style scoped>
.alignment-row { display: flex; align-items: center; gap: 8px; min-width: 0; border-bottom: 1px solid var(--border); }
.alignment-label { flex: 0 0 auto; color: var(--text-2); font-size: 11px; font-weight: 700; letter-spacing: .05em; }
.alignment-control { flex: 1; min-width: 0; }
.alignment-control :deep(.alignment-trigger) { min-height: 32px; padding: 4px 0; border: 0; background: transparent; border-radius: 0; font-size: 15px; }
</style>
