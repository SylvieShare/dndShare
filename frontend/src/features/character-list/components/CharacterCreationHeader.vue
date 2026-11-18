<template>
  <WorkspaceHeader page :scroll-source="scrollSource">
    <template #identity>
      <ActionButton class="cc-x" variant="quiet" icon-only title="Закрыть" aria-label="Закрыть создание персонажа" @click="emit('close')"><template #icon><X :size="20" /></template></ActionButton>
      <span class="creation-title">
        <component :is="red ? Cpu : WandSparkles" class="creation-title-icon" :size="22" aria-hidden="true" />
        <span>Создание персонажа</span>
      </span>
    </template>
    <template #actions>
      <ActionButton v-if="showIncomplete" class="creation-action creation-action--incomplete" variant="quiet" layout="stacked"
        aria-label="Создать неполноценного" title="Создать лист сейчас и заполнить недостающее позже"
        :disabled="incompleteDisabled" :loading="creating" loading-label="Создание…" @click="emit('create-incomplete')">
        <template #icon><UserRoundPlus :size="18" aria-hidden="true" /></template>
        {{ creating ? 'Создание…' : 'Создать неполноценного' }}
      </ActionButton>
      <ActionButton class="creation-action" variant="quiet" layout="stacked" title="Начать создание сначала" aria-label="Начать создание сначала" @click="emit('reset')">
        <template #icon><RotateCcw :size="18" aria-hidden="true" /></template>
        Сбросить
      </ActionButton>
    </template>
  </WorkspaceHeader>
</template>
<script setup>
import { ActionButton } from '@sylvieshare/share-ui'
import { Cpu, RotateCcw, UserRoundPlus, WandSparkles, X } from '@lucide/vue'
import WorkspaceHeader from '@/shared/ui/WorkspaceHeader.vue'
defineProps({ scrollSource: Object, red: Boolean, showIncomplete: Boolean, incompleteDisabled: Boolean, creating: Boolean })
const emit = defineEmits(['close', 'reset', 'create-incomplete'])
</script>
<style scoped>
.creation-title {
  display: flex;
  align-items: center;
  min-width: 0;
  gap: var(--spacing-small);
  font-family: var(--type-workspace-title-family);
  font-size: var(--type-workspace-title-size);
  font-weight: var(--type-workspace-title-weight);
  line-height: var(--type-workspace-title-line-height);
}
.creation-title-icon { flex: none; }
.creation-action {
  --action-button-height: calc(var(--layout-touch-min) + var(--spacing-small));
  justify-content: flex-start;
}
.creation-action--incomplete { inline-size: min-content; }
@media (max-width: 390px) {
  .workspace-header { --workspace-header-column-gap: var(--spacing-xs); }
  .creation-title { font-size: var(--type-group-size); line-height: var(--type-group-line-height); }
  .creation-title-icon { display: none; }
}
</style>
