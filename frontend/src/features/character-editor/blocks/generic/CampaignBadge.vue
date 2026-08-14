<template>
  <div class="cb-wrap" v-click-outside="() => (open = false)">
    <component
      :is="tag"
      :to="(top && !multiple) ? sessionLink(top) : undefined"
      class="cb"
      :class="{ 'cb-clickable': multiple || !!top, open }"
      @click="multiple && (open = !open)"
    >
      <span class="cb-status" :style="{ background: top ? statusColor(top.status) : 'var(--text-muted)' }"></span>
      <span class="cb-text">
        <span class="cb-name">{{ top ? top.name : 'Нет активной сессии' }}</span>
        <span v-if="top && chapter(top)" class="cb-chapter">{{ chapter(top) }}</span>
      </span>
      <svg v-if="multiple" class="cb-chevron" width="10" height="6" viewBox="0 0 10 6" fill="none">
        <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </component>

    <transition name="cb-fade">
      <div v-if="open && multiple" class="cb-menu">
        <component
          :is="'router-link'"
          v-for="s in sessions"
          :key="s.uuid"
          :to="sessionLink(s)"
          class="cb-option"
          @click="open = false"
        >
          <span class="cb-status" :style="{ background: statusColor(s.status) }"></span>
          <span class="cb-text"><span class="cb-name">{{ s.name }}</span></span>
        </component>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useRoute } from 'vue-router'
import { sessionStatusColor } from '@/features/sessions/composables/useSessionStatus'
import { currentChapterLabel } from '@/features/sessions/lib/chapterGraph'

defineProps(['block'])
const ctx = inject('charCtx', { sessions: [], topSession: null })
const open = ref(false)
const route = useRoute()

const sessions = computed(() => ctx.sessions || [])
const top = computed(() => ctx.topSession || sessions.value[0] || null)
const multiple = computed(() => sessions.value.length > 1)
const tag = computed(() => {
  if (multiple.value) return 'button'
  if (top.value) return 'router-link'
  return 'div'
})

const statusColor = sessionStatusColor
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
.cb-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.cb-text { display: flex; flex-direction: column; align-items: flex-start; min-width: 0; line-height: 1.2; flex: 1; }
.cb-name { font-size: 13px; font-weight: 600; color: var(--text-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cb-chapter { font-size: 10px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.cb-chevron { color: var(--text-muted); flex-shrink: 0; transition: transform 0.15s; }
.cb.open .cb-chevron { transform: rotate(180deg); }

.cb-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 60;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--popover-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}
.cb-option { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; color: inherit; text-decoration: none; cursor: pointer; }
.cb-option:hover { background: color-mix(in srgb, var(--text-on-accent) 5%, transparent); }
.cb-option--static { cursor: default; }
.cb-option--static:hover { background: none; }

.cb-fade-enter-active, .cb-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.cb-fade-enter-from, .cb-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
