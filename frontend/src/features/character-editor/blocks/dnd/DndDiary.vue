<template>
  <JournalWorkspace v-if="characterUuid" :character-uuid="characterUuid" />
  <div v-else class="diary-preview-note">Дневник станет доступен после создания персонажа.</div>
</template>

<script setup>
import { computed, inject } from 'vue'
import JournalWorkspace from '@/features/journals/components/JournalWorkspace.vue'

defineProps({ block: Object, value: { default: null } })
const charCtx = inject('charCtx', {})
const characterUuid = computed(() => charCtx.characterUuid || '')
</script>

<style scoped>
.diary-preview-note {
  padding: 16px;
  border: 1px dashed var(--border-strong);
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 12px;
  text-align: center;
}
</style>
