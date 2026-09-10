<template>
  <div class="diary-dialogue">
    <div v-for="line in displayed" :key="line.id" class="diary-voice" :style="{ '--voice': line.color || 'var(--text-muted)' }">
      <span class="diary-speaker">{{ line.speaker || 'Рассказчик' }}</span><p>{{ line.text || '…' }}</p>
    </div>
    <p v-if="!displayed.length" class="diary-empty-copy">Реплики пока не добавлены.</p>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { hydrateDialogueRows } from '@/features/sessions/lib/dialogueRows'
const props = defineProps({ lines: { type: Array, default: () => [] } })
const displayed = computed(() => {
  const colors = hydrateDialogueRows(props.lines.map(line => ({ left: line.speaker, right: line.text, color: line.color })))
  return props.lines.map((line, index) => ({ ...line, color: colors[index].color }))
})
</script>
<style scoped>
.diary-dialogue { display: flex; flex-direction: column; min-width: 0; }
.diary-voice { display: grid; grid-template-columns: minmax(66px, .18fr) minmax(0, 1fr); gap: 12px; align-items: start; padding: 10px 0; }
.diary-voice :deep(.journal-inline-form) { grid-column: 1 / -1; padding: 0; }
.diary-speaker { font-size: 13px; font-weight: 750; color: var(--voice); line-height: 1.8; overflow-wrap: anywhere; }
.diary-voice p { margin: 0; padding-left: 14px; border-left: 2px solid var(--voice); color: var(--text-2); font-family: var(--font-prose); font-size: 14px; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; }
@media (max-width: 720px) {
  .diary-voice { gap: 8px; grid-template-columns: minmax(0, 1fr) auto; }
  .diary-speaker { font-size: 12px; }
  .diary-voice p { grid-column: 1; grid-row: 2; padding-left: 10px; font-size: 14px; }
  .diary-voice > .diary-pencil { grid-column: 2; grid-row: 1 / 3; }
}
</style>
