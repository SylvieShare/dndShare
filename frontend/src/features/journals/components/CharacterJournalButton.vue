<template>
  <button v-if="characterUuid" v-bind="$attrs" class="character-journal-button" type="button" title="Открыть дневник" @click.stop="open = true"><BookOpen :size="17" /><span>Дневник</span></button>
  <JournalWindow v-if="open" :character-uuid="characterUuid" @close="open = false" />
</template>
<script setup>
import { computed, defineAsyncComponent, inject, ref } from 'vue'
import { BookOpen } from '@lucide/vue'
defineOptions({ inheritAttrs: false })
const JournalWindow = defineAsyncComponent(() => import('./JournalWindow.vue'))
const charCtx = inject('charCtx', {})
const characterUuid = computed(() => charCtx.characterUuid || '')
const open = ref(false)
</script>
<style scoped>
.character-journal-button { display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border: 1px solid var(--border); border-radius: 9px; background: var(--surface); color: var(--accent); font: 600 11px var(--font-ui); cursor: pointer; flex-shrink: 0; }
.character-journal-button:hover { background: var(--surface-raised); border-color: var(--accent); }
@media (max-width: 640px) { .character-journal-button span { display: none; } }
</style>
