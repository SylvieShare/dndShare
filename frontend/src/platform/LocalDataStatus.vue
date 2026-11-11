<template>
  <BasePopover :open="open" :anchor="anchor" :min-width="240" @update:open="open = $event">
    <div class="local-status-details">
      <strong>{{ title }}</strong>
      <span>{{ localState.error || 'Справочник и загруженные документы доступны на устройстве. Изменения отправляются при подключении.' }}</span>
      <ActionButton v-if="!localState.syncing" variant="secondary" @click="synchronizeLocalData">Повторить синхронизацию</ActionButton>
    </div>
  </BasePopover>
  <button v-if="localState.accountId && (!localState.online || localState.syncing || localState.error)" ref="anchor" type="button" class="local-status" :aria-label="title" @click="open = !open">
    <CloudOff v-if="!localState.online" :size="16" /><RefreshCw v-else-if="localState.syncing" :size="16" class="local-status-spin" /><CloudAlert v-else :size="16" />
  </button>
</template>
<script setup>
import { computed, ref } from 'vue'
import { ActionButton, BasePopover } from '@sylvieshare/share-ui'
import { CloudAlert, CloudOff, RefreshCw } from '@lucide/vue'
import { localState, synchronizeLocalData } from './offline'
const anchor = ref(null), open = ref(false)
const title = computed(() => !localState.online ? 'Работа без сети' : localState.syncing ? 'Синхронизация данных' : 'Синхронизация требует внимания')
</script>
<style scoped>
.local-status { display:grid;place-items:center;flex:none;width:32px;height:32px;border:0;border-radius:50%;background:var(--surface-raised);color:var(--text-muted);cursor:pointer }
.local-status-details { display:grid;gap:var(--spacing-small);max-width:300px;font-size:12px;color:var(--text-muted) }
.local-status-details strong { color:var(--text-1) }
.local-status-spin { animation:local-spin 1.2s linear infinite }
@keyframes local-spin { to { transform:rotate(360deg) } }
@media (prefers-reduced-motion:reduce) { .local-status-spin { animation:none } }
</style>
