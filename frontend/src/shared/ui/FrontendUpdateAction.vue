<template>
  <div v-if="frontendUpdateReady" ref="anchor" class="frontend-update-action">
    <ActionButton
      variant="quiet"
      icon-only
      data-frontend-update-trigger
      :loading="versionState.applying"
      loading-label="Устанавливаем обновление"
      aria-label="Обновить и перезапустить"
      title="Обновление готово"
      @click="apply"
    >
      <template #icon><RefreshCw :size="20" aria-hidden="true" /></template>
    </ActionButton>
    <BasePopover
      :open="!!error"
      :anchor="anchor"
      placement="bottom-end"
      :min-width="236"
      @update:open="closeError"
    >
      <p class="frontend-update-error" role="alert">{{ error }}</p>
    </BasePopover>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { RefreshCw } from '@lucide/vue'
import { ActionButton, BasePopover } from '@sylvieshare/share-ui'
import { applyFrontendUpdate, frontendUpdateReady, versionState } from '@/platform/updates'

const anchor = ref(null)
const error = ref('')

async function apply() {
  error.value = ''
  error.value = await applyFrontendUpdate() || ''
}

function closeError(open) {
  if (!open) error.value = ''
}
</script>

<style scoped>
.frontend-update-action { display: flex; max-width: 100%; }
.frontend-update-error { max-width: 240px; margin: 0; padding: 8px 10px; color: var(--text-1); }
</style>
