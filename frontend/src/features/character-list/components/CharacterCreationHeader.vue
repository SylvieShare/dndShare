<template>
  <WorkspaceHeader page :scroll-source="scrollSource">
    <template #identity>
      <ActionButton class="cc-x" variant="quiet" icon-only title="Закрыть" aria-label="Закрыть создание персонажа" @click="emit('close')"><template #icon><X :size="20" /></template></ActionButton>
      <span class="creation-title"><component :is="red ? Cpu : WandSparkles" :size="22" aria-hidden="true" />Создание персонажа</span>
    </template>
    <template #actions><ActionButton class="cc-mobile-reset" :class="{ 'creation-reset--compact': red }" variant="quiet" title="Начать создание сначала" aria-label="Начать создание сначала" @click="emit('reset')"><template #icon><RotateCcw :size="18" /></template>Сбросить</ActionButton></template>
  </WorkspaceHeader>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Cpu, RotateCcw, WandSparkles, X } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
defineProps({scrollSource:Object, red:Boolean})
const emit=defineEmits(['close','reset'])
</script>
<style scoped>
.creation-title {display:flex;align-items:center;gap:var(--spacing-small);font-family:var(--type-workspace-title-family);font-size:var(--type-workspace-title-size);font-weight:var(--type-workspace-title-weight);line-height:var(--type-workspace-title-line-height)}
@media (min-width: 921px) {
  .creation-reset--compact { display: none; }
}
</style>
