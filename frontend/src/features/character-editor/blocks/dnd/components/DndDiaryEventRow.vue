<template>
  <!-- Shared event face, rendered in the session timeline and in the morph #view so they never drift. -->
  <div v-if="event.type === 'newday'" class="der-day" :style="{ '--ec': meta.color }">
    <span class="der-day-line"></span>
    <span class="der-day-label">
      <component :is="meta.icon" :size="14" :stroke-width="2" />
      {{ event.title || meta.label }}
    </span>
    <span class="der-day-line"></span>
  </div>

  <div v-else class="der" :style="{ '--ec': meta.color }">
    <span class="der-node">
      <component :is="meta.icon" :size="13" :stroke-width="2" />
    </span>
    <div class="der-body">
      <div class="der-title" :class="{ 'der-title--empty': !event.title }">{{ event.title || meta.label }}</div>
      <div v-if="event.type === 'dialog' && event.dialogue.length" class="der-dialogue">
        <div
          v-for="line in event.dialogue"
          :key="line.id"
          class="der-line"
          :class="{ 'der-line--anonymous': !line.speaker }"
        >
          <span v-if="line.speaker" class="der-speaker">{{ line.speaker }}</span>
          <span class="der-line-text">{{ line.text || '…' }}</span>
        </div>
      </div>
      <div v-if="event.type === 'battle' && event.combatants.length" class="der-combatants">
        <div v-for="combatant in event.combatants" :key="combatant.id" class="der-combatant">
          <span class="der-combatant-count">×{{ combatant.count }}</span>
          <span class="der-combatant-name">{{ combatantName(combatant) }}</span>
          <span v-if="combatant.source === 'custom' && (combatant.ac != null || combatant.hp != null)" class="der-combatant-stats">
            <template v-if="combatant.ac != null">КБ {{ combatant.ac }}</template>
            <template v-if="combatant.ac != null && combatant.hp != null"> · </template>
            <template v-if="combatant.hp != null">HP {{ combatant.hp }}</template>
          </span>
          <span v-if="combatant.source === 'custom' && combatant.desc" class="der-combatant-desc">{{ combatant.desc }}</span>
        </div>
      </div>
      <RichContent v-if="hasDesc" class="der-desc" :html="descHtml" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import RichContent from '@/shared/ui/RichContent'
import { eventTypeMeta } from '@/features/character-editor/blocks/dnd/lib/diaryEntry'

const props = defineProps({
  event: { type: Object, required: true },
})

const meta = computed(() => eventTypeMeta(props.event.type))

function combatantName(combatant) {
  if (combatant.source === 'handbook') {
    return combatant.itemName || (combatant.itemId != null ? `Существо #${combatant.itemId}` : 'Существо не выбрано')
  }
  return combatant.name || 'Своё существо'
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Rich HTML from the editor as-is; legacy plain-text descs get escaped with line breaks kept.
const descHtml = computed(() => {
  const d = props.event.desc || ''
  if (!d) return ''
  if (/<[a-z][\s\S]*>/i.test(d)) return d
  return escapeHtml(d).split('\n').join('<br>')
})

const hasDesc = computed(() => descHtml.value.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim() !== '')
</script>

<style scoped>
.der {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  min-width: 0;
}

.der-node {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--ec) 12%, var(--surface));
  border: 1px solid color-mix(in srgb, var(--ec) 40%, var(--border));
  color: var(--ec);
}

.der-body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
  padding-top: 4px;
}

.der-title {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.3;
  color: var(--text-1);
  overflow-wrap: anywhere;
}
.der-title--empty { color: var(--text-2); font-weight: 500; }

.der-desc {
  font-size: 12.5px;
  color: var(--text-2);
  min-width: 0;
}

.der-dialogue,
.der-combatants {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 2px;
  min-width: 0;
}
.der-line {
  display: grid;
  grid-template-columns: minmax(58px, auto) 1fr;
  gap: 7px;
  padding: 5px 8px;
  border-left: 2px solid color-mix(in srgb, var(--ec) 35%, var(--border));
  background: color-mix(in srgb, var(--ec) 4%, transparent);
  border-radius: 0 6px 6px 0;
  min-width: 0;
}
.der-speaker { font-size: 11px; font-weight: 700; color: var(--ec); overflow-wrap: anywhere; }
.der-line-text { font-size: 12px; line-height: 1.4; color: var(--text-2); white-space: pre-line; overflow-wrap: anywhere; }
.der-line--anonymous { grid-template-columns: 1fr; }
.der-combatant {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--danger) 18%, var(--border));
  border-radius: 7px;
  background: color-mix(in srgb, var(--danger) 4%, transparent);
}
.der-combatant-count { color: var(--danger); font-size: 11px; font-weight: 800; }
.der-combatant-name { color: var(--text-1); font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
.der-combatant-stats { color: var(--text-muted); font-size: 10px; white-space: nowrap; }
.der-combatant-desc {
  grid-column: 2 / -1;
  color: var(--text-2);
  font-size: 11px;
  line-height: 1.35;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.der-day {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.der-day-line {
  flex: 1;
  height: 1px;
  background: color-mix(in srgb, var(--ec) 30%, var(--border));
}
.der-day-line:first-child { max-width: 26px; }
.der-day-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--ec) 80%, var(--text-2));
}
</style>
