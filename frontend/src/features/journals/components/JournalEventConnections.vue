<template>
  <section class="journal-connections">
    <h4>Связи истории</h4>
    <div v-for="link in connections" :key="link.id" class="journal-connection">
      <ArrowDownLeft v-if="link.incoming" :size="16" /><ArrowUpRight v-else :size="16" />
      <button type="button" :disabled="disabled" @click="$emit('navigate', link.event)"><strong>{{ link.event.title || 'Без названия' }}</strong><span>{{ link.label || (link.incoming ? 'До этого' : 'После этого') }} · {{ link.event.sectionTitle }}</span></button>
      <RemoveButton v-if="editable" icon="trash" label="Удалить связь, сохранив события" :disabled="disabled" @click="$emit('unlink', link)" />
    </div>
    <p v-if="!connections.length">Пока отдельное событие. Соедините его с историей.</p>
    <div v-if="editable" class="journal-connection-create">
      <ValueSelect v-model="target" :options="options" :disabled="disabled" searchable :search-threshold="0" search-placeholder="Найти событие…" empty-label="Нет доступных событий" aria-label="Продолжение истории" placeholder="Продолжение в любом разделе…" drop-up />
      <button type="button" :disabled="disabled || !target" @click="connect"><GitMerge :size="15" /> Соединить</button>
    </div>
  </section>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { ArrowDownLeft, ArrowUpRight, GitMerge } from '@lucide/vue'
import { RemoveButton, ValueSelect } from '@sylvieshare/share-ui'
import { canConnectJournal, journalEntries, journalEntryConnections } from '../lib/journalGraph'
const props = defineProps({ journal: Object, eventId: String, editable: Boolean, disabled: Boolean })
const emit = defineEmits(['navigate', 'unlink', 'connect'])
const target = ref(null)
const connections = computed(() => journalEntryConnections(props.journal, props.eventId))
const options = computed(() => journalEntries(props.journal).filter(event => canConnectJournal(props.journal.graph.links, props.eventId, event.id)).map(event => ({ value: event.id, label: `${event.title || 'Без названия'} · ${event.sectionTitle}` })))
watch(() => props.eventId, () => { target.value = null })
function connect() { if (target.value) emit('connect', props.eventId, target.value); target.value = null }
</script>
<style scoped>
.journal-connections { padding: 20px; border-top: 1px solid var(--border); }
.journal-connections h4 { margin: 0 0 14px; color: var(--text-muted); font-size: 11px; letter-spacing: .05em; text-transform: uppercase; }
.journal-connection { display: flex; align-items: center; gap: 10px; padding: 8px 0; }
.journal-connection > svg { flex-shrink: 0; color: var(--accent); }
.journal-connection > button { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 5px; border: 0; padding: 4px; background: transparent; text-align: left; color: var(--text-1); cursor: pointer; }
.journal-connection strong { font-size: 13px; overflow-wrap: anywhere; }
.journal-connection span, .journal-connections p { color: var(--text-muted); font-size: 11px; line-height: 1.5; }
.journal-connection-create { display: flex; flex-direction: column; gap: 10px; margin-top: 16px; }
.journal-connection-create button { align-self: flex-start; display: flex; align-items: center; gap: 7px; border: 0; background: transparent; color: var(--accent); padding: 6px 0; cursor: pointer; }
.journal-connections button:disabled { opacity: .4; cursor: default; }
</style>
