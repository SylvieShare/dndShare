<template>
  <div class="top-bar">
    <template v-if="session">
      <button class="session-info" @click="$emit('edit')">
        <span class="session-title">{{ session.name }}</span>
      </button>

      <span v-if="isDm || currentChapter" class="top-rule" />
      <button v-if="isDm || currentChapter" type="button" class="chapter-location" @click="$emit('open-chapters')">
        <template v-if="currentChapter">
          <span class="arc-badge">Арка {{ romanNumeral(currentChapter.arcOrder) }}</span>
          <span class="location-chevron">›</span>
          <span class="chapter-badge">Глава {{ currentChapter.number }}</span>
          <span class="chapter-location-name">{{ currentChapter.name }}</span>
        </template>
        <template v-else>
          <span class="chapter-badge chapter-badge--empty">Главы</span>
          <span class="chapter-location-name">Открыть карту кампании</span>
        </template>
      </button>

      <SessionStatusMenu
        v-if="isDm"
        :session="session"
        :session-uuid="sessionUuid"
        @status-change="$emit('status-change', $event)"
      />
    </template>
  </div>
</template>

<script setup>
import SessionStatusMenu from '@/features/sessions/components/SessionStatusMenu.vue'
import { romanNumeral } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  session: { type: Object, default: null },
  sessionUuid: { type: String, required: true },
  isDm: { type: Boolean, default: false },
  currentChapter: { type: Object, default: null },
})
defineEmits(['edit', 'status-change', 'open-chapters'])
</script>

<style scoped>
.top-bar { display: flex; align-items: center; gap: 10px; padding: 8px 16px; flex-shrink: 0; }
.session-info { display: flex; min-width: 0; flex-shrink: 1; padding: 4px 8px; border: 0; border-radius: 6px; background: none; cursor: pointer; }
.session-info:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }
.session-title { min-width: 0; overflow: hidden; color: var(--text-1); font-family: var(--font-display); font-size: 21px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
.top-rule { width: 1px; height: 16px; flex: none; background: color-mix(in srgb, var(--text-on-accent) 10%, transparent); }

.chapter-location { display: flex; min-width: 0; align-items: center; gap: 6px; padding: 3px 8px 3px 4px; border: 1px solid color-mix(in srgb, var(--text-on-accent) 7%, transparent); border-radius: 8px; background: none; color: var(--text-2); font: inherit; font-size: 12px; cursor: pointer; }
.chapter-location:hover { border-color: color-mix(in srgb, var(--accent) 35%, transparent); background: color-mix(in srgb, var(--accent) 8%, transparent); color: var(--text-1); }
.arc-badge,
.chapter-badge { display: inline-flex; height: 22px; align-items: center; padding: 0 7px; border-radius: 5px; font-size: 10px; font-weight: 800; white-space: nowrap; }
.arc-badge { background: var(--surface-raised); color: var(--accent-soft); }
.chapter-badge { background: var(--accent); color: var(--text-on-accent); }
.chapter-badge--empty { background: var(--surface-raised); color: var(--accent-soft); }
.location-chevron { color: var(--text-muted); }
.chapter-location-name { max-width: 190px; overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }

@media (max-width: 760px) {
  .chapter-location-name, .arc-badge, .location-chevron { display: none; }
}
</style>
