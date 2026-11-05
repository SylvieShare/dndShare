<script setup>
import { computed, inject } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
const context = inject('charCtx', {})
const message = computed(() => context.saveStatus === 'error' ? context.saveError || 'Не удалось сохранить'
  : context.saveStatus === 'pending' || context.saveStatus === 'saving' ? 'Сохраняем изменения…' : 'Сохранено')
</script>
<template>
  <div v-if="context.saveStatus" class="sheet-save-feedback" :class="{ 'sheet-save-feedback--error': context.saveStatus === 'error' }" role="status" aria-live="polite">
    <span>{{ message }}</span>
    <ActionButton v-if="context.saveStatus === 'error'" variant="quiet" @click="context.retrySave?.()">Повторить</ActionButton>
  </div>
</template>
<style scoped>
.sheet-save-feedback { min-height: 36px; padding: 8px 16px; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-muted); font: 12px/18px var(--font-ui); }
.sheet-save-feedback--error { color: var(--danger); }
</style>
