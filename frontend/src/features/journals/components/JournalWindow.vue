<template>
  <AppModal ref="modal" fullscreen flush :z-index="3300" :show-close="false" :show-handle="false" :dismissible="!blocked" aria-label="Дневник кампании" @close="$emit('close')">
    <div class="journal-window"><JournalWorkspace :character-uuid="characterUuid" @blocking="blocked = $event">
      <template #actions><button class="journal-window-close" type="button" :disabled="blocked" aria-label="Закрыть дневник" @click="modal?.requestClose()"><X :size="21" /></button></template>
    </JournalWorkspace></div>
  </AppModal>
</template>
<script setup>
import { ref } from 'vue'
import { X } from '@lucide/vue'
import { AppModal } from '@sylvieshare/share-ui'
import JournalWorkspace from './JournalWorkspace.vue'
defineProps({ characterUuid: { type: String, required: true } })
defineEmits(['close'])
const blocked = ref(false)
const modal = ref(null)
</script>
<style scoped>
.journal-window { height: 100%; min-height: 0; width: 100%; padding: 20px; box-sizing: border-box; background: var(--bg); }
.journal-window-close { display: grid; place-items: center; width: 36px; height: 36px; border: 0; border-radius: 8px; background: var(--surface); color: var(--text-2); cursor: pointer; }
.journal-window-close:disabled { opacity: .35; cursor: default; }
@media (max-width: 720px) { .journal-window { padding: 12px; } }
</style>
