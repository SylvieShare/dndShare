<template>
  <div class="cb-wrap">
    <component
      :is="tag"
      :to="top ? sessionLink(top) : undefined"
      class="cb"
      :class="{ 'cb-clickable': !!top }"
    >
      <span class="cb-text">
        <span class="cb-name">{{ top ? top.name : 'Нет сессии' }}</span>
        <span v-if="top && chapter(top)" class="cb-chapter">{{ chapter(top) }}</span>
      </span>
    </component>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { useRoute } from 'vue-router'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'

defineProps(['block'])
const ctx = inject('charCtx', { sessions: [], topSession: null })
const route = useRoute()

const sessions = computed(() => ctx.sessions || [])
const top = computed(() => ctx.topSession || sessions.value[0] || null)
const tag = computed(() => {
  if (top.value) return 'router-link'
  return 'div'
})

function chapter(s) {
  return currentChapterLabel(s, true)
}
function sessionLink(s) {
  if (s.isGm) return '/sessions/' + s.uuid
  return { name: 'Character', params: { uuid: route.params.uuid }, query: { ...route.query, session: s.uuid } }
}
</script>

<style scoped>
.cb-wrap { position: relative; }
.cb {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  box-sizing: border-box;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: var(--r-md);
  background: var(--surface);
  color: inherit;
  text-decoration: none;
  font: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.cb-clickable { cursor: pointer; }
.cb-clickable:hover { border-color: var(--border-strong); }
.cb-text { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; line-height: 1.2; flex: 1; }
.cb-name { font-size: 13px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cb-chapter { font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
</style>
