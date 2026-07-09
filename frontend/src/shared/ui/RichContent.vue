<template>
  <div class="rc" v-html="rendered" />
</template>

<script setup>
import { computed } from 'vue'

// Single renderer for the rich HTML produced by InputDescription. EVERY place that displays that
// content must go through this component, never a bare `v-html`. It owns the canonical typography
// (headings / lists / paragraphs / inline marks) so the look is identical everywhere, and it is the
// one seam where interactive elements (dice rolls, references, embeds) will later be parsed out of
// the stored markup and rendered as real components — keep that pipeline in `rendered`.
//
// Base font-size / colour are inherited from the call site (put your sizing class on <RichContent>),
// so a tooltip stays small and a detail pane stays large without this component knowing about it.
const props = defineProps({
  html: { type: String, default: '' },
})

const rendered = computed(() => props.html || '')
</script>

<style scoped>
.rc {
  font: inherit;
  color: inherit;
  line-height: 1.45;
  overflow-wrap: anywhere;
  word-break: normal;
}

.rc :deep(p) { margin: 0 0 6px; }
.rc :deep(p:last-child) { margin-bottom: 0; }

.rc :deep(h1) { font-size: 22px; font-weight: 700; color: var(--text-1); margin: 0 0 8px; line-height: 1.3; }
.rc :deep(h2) { font-size: 18px; font-weight: 700; color: var(--text-1); margin: 0 0 8px; line-height: 1.3; }
.rc :deep(h3) { font-size: 16px; font-weight: 600; color: var(--text-2); margin: 0 0 6px; line-height: 1.3; }
.rc :deep(h4) { font-size: 14px; font-weight: 600; color: var(--text-2); margin: 0 0 6px; }
.rc :deep(h5) { font-size: 13px; font-weight: 600; color: var(--text-2); margin: 0 0 4px; }
.rc :deep(h6) { font-size: 12px; font-weight: 600; color: var(--text-muted); margin: 0 0 4px; }

.rc :deep(ul),
.rc :deep(ol) { margin: 6px 0 8px 20px; padding: 0; }
.rc :deep(li) { margin: 3px 0; }

.rc :deep(a) { color: var(--accent); text-decoration: underline; }

.rc :deep(table) { border-collapse: collapse; margin: 8px 0; font-size: 0.92em; }
.rc :deep(td),
.rc :deep(th) { border: 1px solid var(--border); padding: 3px 8px; }
</style>
