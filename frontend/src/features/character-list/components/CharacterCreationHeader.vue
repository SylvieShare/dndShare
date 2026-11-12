<template>
  <WorkspaceHeader page :scroll-source="scrollSource">
    <template #identity>
      <ActionButton class="cc-x" variant="quiet" icon-only title="Закрыть" aria-label="Закрыть создание персонажа" @click="emit('close')"><template #icon><X :size="20" /></template></ActionButton>
      <span class="creation-title"><WandSparkles :size="22" />Создание персонажа</span>
    </template>
    <template #actions><ActionButton class="cc-mobile-reset" variant="quiet" title="Начать создание сначала" aria-label="Начать создание сначала" @click="emit('reset')"><template #icon><RotateCcw :size="18" /></template>Сбросить</ActionButton></template>
  </WorkspaceHeader>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { RotateCcw, WandSparkles, X } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
defineProps({scrollSource:Object})
const emit=defineEmits(['close','reset'])
</script>
<style scoped>
.creation-title {display:flex;align-items:center;gap:var(--spacing-small);font-family:var(--type-header-family);font-size:var(--type-header-size);font-weight:var(--type-header-weight);line-height:var(--type-header-line-height)}
</style>
