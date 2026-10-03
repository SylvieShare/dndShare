<template>
  <BaseTile class="item-mechanic-panel" :class="{ 'item-mechanic-panel--resource': kind === 'resource' }" framed :color="presentation.color" :style="{ '--mechanic-tone': presentation.color }" @click.stop @pointerdown.stop>
    <component :is="collapse ? 'details' : 'div'" class="item-mechanic-disclosure">
      <component :is="collapse ? 'summary' : 'div'" class="item-mechanic-heading">
        <div v-if="kind !== 'resource'" class="item-mechanic-icon"><slot name="icon"><component :is="presentation.icon" :size="24" /></slot></div>
        <div class="item-mechanic-title"><span v-if="kind !== 'resource'">{{ presentation.label }}</span><strong>{{ title }}</strong></div>
        <div v-if="$slots.summary" class="item-mechanic-summary" @click.stop @pointerdown.stop @keydown.enter.stop @keydown.space.stop><slot name="summary" /></div>
        <ChevronDown v-if="collapse" class="item-mechanic-chevron" :size="16" aria-hidden="true" />
      </component>
      <div v-if="subtitle || $slots.default || $slots.actions" class="item-mechanic-expanded">
        <p v-if="subtitle" class="item-mechanic-subtitle">{{ subtitle }}</p>
        <div v-if="$slots.default" class="item-mechanic-body"><slot /></div>
        <div v-if="$slots.actions" class="item-mechanic-actions"><slot name="actions" /></div>
      </div>
    </component>
  </BaseTile>
</template>
<script setup>
import { computed, inject } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { ChevronDown } from '@lucide/vue'
import { itemMechanicKinds } from '@/features/items/lib/itemMechanicPresentation'
const props = defineProps({ kind: { type: String, default: 'rule', validator: value => value in itemMechanicKinds }, title: String, subtitle: String, collapsible: { type: Boolean, default: undefined } })
const collapseContext = inject('weaponMechanicCollapse', false)
const collapse = computed(() => props.collapsible ?? collapseContext)
const presentation = computed(() => itemMechanicKinds[props.kind] || itemMechanicKinds.rule)
</script>
<style scoped>
.item-mechanic-panel { padding: 12px; min-width: 0; cursor: default; }
.item-mechanic-heading { display: flex; align-items: center; gap: 10px; list-style: none; }
summary.item-mechanic-heading { cursor: pointer; }
summary.item-mechanic-heading::-webkit-details-marker { display: none; }
summary.item-mechanic-heading:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; border-radius: 4px; }
.item-mechanic-icon { display: flex; align-items: center; justify-content: center; color: var(--mechanic-tone); }
.item-mechanic-title { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.item-mechanic-title > span { display: block; margin-bottom: 3px; color: var(--mechanic-tone); font-size: 10px; font-weight: 650; }
.item-mechanic-title strong { font-size: 13px; color: var(--text-1); }
.item-mechanic-summary { flex-shrink: 0; max-width: 65%; min-width: 0; }
.item-mechanic-summary :deep(.item-resource), .item-mechanic-summary :deep(.item-resource-pips) { justify-content: flex-end; }
.item-mechanic-chevron { flex-shrink: 0; color: var(--text-muted); }
.item-mechanic-disclosure[open] > .item-mechanic-heading > .item-mechanic-chevron { transform: rotate(180deg); }
.item-mechanic-expanded { display: grid; gap: 10px; padding-top: 10px; }
.item-mechanic-subtitle { margin: 0; font-size: 12px; line-height: 1.4; color: var(--text-2); }
.item-mechanic-panel--resource .item-mechanic-title strong { font-size: 14px; }
.item-mechanic-body { display: grid; gap: 8px; min-width: 0; }
.item-mechanic-body :deep(.mechanic-theses) { margin: 0; }
.item-mechanic-actions { display: flex; flex-wrap: wrap; gap: 6px; padding-top: 8px; border-top: 1px solid var(--border); }
</style>
