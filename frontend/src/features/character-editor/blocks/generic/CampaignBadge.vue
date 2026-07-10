<template>
  <div class="cb-wrap" v-click-outside="() => (open = false)">
    <component
      :is="tag"
      :to="(top && top.isGm && !multiple) ? sessionLink(top) : undefined"
      class="cb"
      :class="{ 'cb-clickable': multiple || (top && top.isGm), open }"
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
          :is="s.isGm ? 'router-link' : 'div'"
          v-for="s in sessions"
          :key="s.uuid"
          :to="s.isGm ? sessionLink(s) : undefined"
          class="cb-option"
          :class="{ 'cb-option--static': !s.isGm }"
          @click="s.isGm && (open = false)"
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

defineProps(['block'])
const ctx = inject('charCtx', { sessions: [], topSession: null })
const open = ref(false)

const sessions = computed(() => ctx.sessions || [])
const top = computed(() => ctx.topSession || sessions.value[0] || null)
const multiple = computed(() => sessions.value.length > 1)
const tag = computed(() => {
  if (multiple.value) return 'button'
  if (top.value && top.value.isGm) return 'router-link'
  return 'div'
})

const STATUS_CFG = {
  live: '#e85c5c', active: '#5ce87c', planned: '#5c95e8', paused: '#e89c3c',
  completed: '#707080', draft: 'var(--text-muted)', archived: 'var(--text-muted)',
}
function statusColor(s) { return STATUS_CFG[s] || 'var(--text-muted)' }
function chapter(s) {
  const num = s.chapterNumber != null ? `Гл. ${s.chapterNumber}` : ''
  return [num, s.chapterName].filter(Boolean).join(' · ')
}
function sessionLink(s) { return '/sessions/' + s.uuid }
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
  background: var(--block-bg);
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
  background: var(--popup-bg);
  border: 1px solid var(--border-strong);
  border-radius: var(--r-md);
  box-shadow: var(--shadow-lg);
}
.cb-option { display: flex; align-items: center; gap: 8px; padding: 7px 9px; border-radius: 7px; color: inherit; text-decoration: none; cursor: pointer; }
.cb-option:hover { background: rgba(255, 255, 255, 0.05); }
.cb-option--static { cursor: default; }
.cb-option--static:hover { background: none; }

.cb-fade-enter-active, .cb-fade-leave-active { transition: opacity 0.12s ease, transform 0.12s ease; }
.cb-fade-enter-from, .cb-fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
