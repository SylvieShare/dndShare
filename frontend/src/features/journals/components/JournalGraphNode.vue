<template>
  <BaseTile class="journal-node" :class="{ 'journal-node--selected': selected, 'journal-node--day': event.type === 'newday' }" :color="meta.color" framed>
    <header class="journal-node-heading"><component :is="meta.icon" :size="19" /><strong>{{ event.title || 'Без названия' }}</strong><span v-if="event.externalLinks" title="Есть связи с другими разделами"><ExternalLink :size="14" /></span></header>
    <div v-if="event.type === 'battle'" class="journal-node-creatures">
      <div v-for="creature in event.combatants.slice(0, 3)" :key="creature.id">
        <ItemIcon v-if="creature.source === 'handbook'" :item="itemsById.get(String(creature.itemId))" :size="25" placeholder />
        <PawPrint v-else :size="20" />
        <span>{{ creature.itemName || (creature.source === 'handbook' ? itemsById.get(String(creature.itemId))?.name : creature.name) || 'Существо' }}</span><small v-if="creature.count > 1">×{{ creature.count }}</small>
      </div>
      <span v-if="event.combatants.length > 3" class="journal-node-more">…</span>
    </div>
    <div v-else-if="event.type === 'dialog'" class="journal-node-dialogue">
      <p v-for="line in dialogue" :key="line.id" :style="{ '--voice': line.color }"><b>{{ line.left || 'Голос' }}</b><span>{{ line.right || '…' }}</span></p>
    </div>
    <RichContent v-else-if="event.desc" class="journal-node-excerpt" :html="event.desc" />
    <span v-else class="journal-node-empty">{{ event.type === 'newday' ? 'Следующая страница истории' : 'Открыть запись' }}</span>
  </BaseTile>
</template>
<script setup>
import { computed } from 'vue'
import { ExternalLink, PawPrint } from '@lucide/vue'
import { BaseTile, RichContent } from '@sylvieshare/share-ui'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { eventTypeMeta } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'
import { hydrateDialogueRows } from '@/features/sessions/lib/dialogueRows'
const props = defineProps({ event: Object, selected: Boolean, itemsById: { type: Map, default: () => new Map() } })
const meta = computed(() => eventTypeMeta(props.event.type))
const dialogue = computed(() => hydrateDialogueRows((props.event.dialogue || []).slice(0, 2).map(line => ({ ...line, left: line.speaker, right: line.text }))))
</script>
<style scoped>
.journal-node { height: 100%; box-sizing: border-box; padding: 14px 16px; overflow: hidden; user-select: none; }
.journal-node--selected { box-shadow: 0 0 0 2px var(--tile-color), var(--shadow-lg); }
.journal-node-heading { display: flex; align-items: center; gap: 9px; color: var(--tile-color); margin-bottom: 12px; }
.journal-node-heading > svg, .journal-node-heading > span { flex-shrink: 0; }
.journal-node-heading strong { flex: 1; min-width: 0; color: var(--text-1); font: 600 17px/1.25 var(--font-display); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.journal-node-creatures { display: flex; flex-direction: column; gap: 5px; }
.journal-node-creatures > div { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.journal-node-creatures > div > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.journal-node-creatures small, .journal-node-more { color: var(--text-muted); }
.journal-node-dialogue { display: flex; flex-direction: column; gap: 8px; }
.journal-node-dialogue p { display: flex; gap: 8px; margin: 0; font-size: 12px; }
.journal-node-dialogue b { flex: 0 0 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--voice); }
.journal-node-dialogue span { border-left: 2px solid var(--voice); padding-left: 8px; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-height: 1.45; }
.journal-node-excerpt { color: var(--text-2); font: 13px/1.6 var(--font-prose); max-height: 64px; overflow: hidden; pointer-events: none; }
.journal-node-excerpt :deep(p) { margin: 0; }
.journal-node-excerpt :deep(img) { display: none; }
.journal-node-empty { color: var(--text-muted); font: italic 13px var(--font-prose); }
.journal-node--day { background: color-mix(in srgb, var(--warning) 6%, var(--surface)); }
</style>
