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
  background: color-mix(in srgb, var(--ec) 12%, var(--block-bg));
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
