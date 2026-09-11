<template>
  <BaseTile class="item-use-panel" @click.stop @pointerdown.stop>
    <div class="item-use-heading"><slot name="icon"><Sparkles :size="24" /></slot><div><strong>{{ title }}</strong><p v-if="subtitle">{{ subtitle }}</p></div></div>
    <slot />
    <div v-if="$slots.actions" class="item-use-actions"><slot name="actions" /></div>
  </BaseTile>
</template>
<script setup>
import { BaseTile } from '@sylvieshare/share-ui'
import { Sparkles } from '@lucide/vue'
defineProps({ title: String, subtitle: String })
</script>
<style scoped>
.item-use-panel { padding: 12px; display: grid; gap: 10px; cursor: default; }
.item-use-heading { display: flex; align-items: center; gap: 10px; }
.item-use-heading > div { min-width: 0; }
.item-use-heading > :first-child { flex-shrink: 0; }
.item-use-heading strong { font-size: 13px; color: var(--text-1); }
.item-use-heading p { margin: 4px 0 0; font-size: 12px; line-height: 1.4; color: var(--text-2); }
.item-use-actions { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
