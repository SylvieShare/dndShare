<template>
  <BaseTile class="item-mechanic-panel" framed :color="presentation.color" :style="{ '--mechanic-tone': presentation.color }" @click.stop @pointerdown.stop>
    <div class="item-mechanic-heading">
      <div class="item-mechanic-icon"><slot name="icon"><component :is="presentation.icon" :size="24" /></slot></div>
      <div class="item-mechanic-title"><span>{{ presentation.label }}</span><strong>{{ title }}</strong><p v-if="subtitle">{{ subtitle }}</p></div>
    </div>
    <div v-if="$slots.default" class="item-mechanic-body"><slot /></div>
    <div v-if="$slots.actions" class="item-mechanic-actions"><slot name="actions" /></div>
  </BaseTile>
</template>
<script setup>
import { computed } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { itemMechanicKinds } from '@/features/items/lib/itemMechanicPresentation'
const props = defineProps({ kind: { type: String, default: 'rule', validator: value => value in itemMechanicKinds }, title: String, subtitle: String })
const presentation = computed(() => itemMechanicKinds[props.kind] || itemMechanicKinds.rule)
</script>
<style scoped>
.item-mechanic-panel { padding: 12px; display: grid; gap: 10px; min-width: 0; cursor: default; }
.item-mechanic-heading { display: grid; grid-template-columns: 32px minmax(0, 1fr); align-items: center; gap: 10px; }
.item-mechanic-icon { display: flex; align-items: center; justify-content: center; color: var(--mechanic-tone); }
.item-mechanic-title { min-width: 0; overflow-wrap: anywhere; }
.item-mechanic-title > span { display: block; margin-bottom: 3px; color: var(--mechanic-tone); font-size: 10px; font-weight: 650; }
.item-mechanic-title strong { font-size: 13px; color: var(--text-1); }
.item-mechanic-title p { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: var(--text-2); }
.item-mechanic-body { display: grid; gap: 8px; min-width: 0; }
.item-mechanic-body :deep(.mechanic-theses) { margin: 0; }
.item-mechanic-actions { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; border-top: 1px solid var(--border); }
</style>
