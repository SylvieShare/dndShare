<template>
  <button class="status" type="button" :aria-label="label" :title="label"><Sparkles aria-hidden="true" :size="15" /><span>{{ names[0] || 'Состояния' }}</span><b v-if="names.length > 1">+{{ names.length - 1 }}</b></button>
</template>
<script setup>
import { computed, inject } from 'vue'
import { Sparkles } from '@lucide/vue'
import { isInspirationActive } from '../../blocks/dnd/lib/mobileStatus'
const ctx = inject('charCtx', {})
const names = computed(() => [...(ctx.characterStatuses?.entries || []).map(state => state.title),
  ...(ctx.values?.exhaustion?.level > 0 ? ['Истощение ' + ctx.values.exhaustion.level] : []),
  ...(isInspirationActive(ctx.values?.inspiration) ? ['Вдохновение'] : [])])
const label = computed(() => names.value.length ? 'Состояния: ' + names.value.join(', ') : 'Состояния')
</script>
<style scoped>
.status { display:inline-flex;min-width:0;max-width:16em;align-items:center;gap:4px;padding:4px 2px;min-height:32px;border:0;background:transparent;color:var(--accent-soft);font:inherit;font-size:var(--type-context-size);cursor:pointer }
.status svg,.status b {flex:none} .status span {overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
</style>
