<template>
  <button ref="trigger" class="journal-add-event" :class="{ 'journal-add-event--quiet': quiet }" type="button" :disabled="disabled" :aria-expanded="open" @click="open = !open"><Plus :size="17" /> {{ label }}</button>
  <BasePopover v-model:open="open" :anchor="trigger" placement="bottom-start" :min-width="270" :z-index="3500" transition-preset="action-menu">
    <div class="journal-event-types">
      <small>Что произошло?</small>
      <button v-for="type in EVENT_TYPES" :key="type.value" type="button" :disabled="disabled" @click="choose(type.value)">
        <span :style="{ color: type.color }"><component :is="type.icon" :size="22" /></span><strong>{{ type.label }}</strong>
      </button>
    </div>
  </BasePopover>
</template>
<script setup>
import { ref, watch } from 'vue'
import { Plus } from '@lucide/vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { EVENT_TYPES } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
const props = defineProps({ disabled: Boolean, quiet: Boolean, label: { type: String, default: 'Добавить событие' } })
const emit = defineEmits(['create'])
const open = ref(false)
const trigger = ref(null)
function choose(type) { if (!props.disabled) { open.value = false; emit('create', type) } }
watch(() => props.disabled, value => { if (value) open.value = false })
</script>
<style scoped>
.journal-add-event { display: inline-flex; align-items: center; gap: 9px; padding: 12px 18px; border: 1px solid color-mix(in srgb, var(--accent) 45%, var(--border)); border-radius: 10px; background: color-mix(in srgb, var(--accent) 10%, var(--surface)); color: var(--accent); font: 700 13px var(--font-ui); cursor: pointer; }
.journal-add-event:disabled { opacity: .5; cursor: default; }
.journal-add-event--quiet { background: transparent; border-color: transparent; color: var(--text-2); }
.journal-event-types { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.journal-event-types small { grid-column: 1 / -1; padding: 5px 8px; color: var(--text-muted); font-size: 12px; }
.journal-event-types button { display: flex; align-items: center; gap: 10px; padding: 16px 12px; border: 0; border-radius: 9px; background: transparent; color: var(--text-1); font: 13px var(--font-ui); cursor: pointer; }
.journal-event-types button:hover { background: var(--surface-raised); }
</style>
