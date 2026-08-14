<template>
  <section
    class="session-center-workspace"
    :class="{ 'session-center-workspace--closing': closing, 'session-center-workspace--without-chapter': !chapter }"
    :style="workspaceStyle"
    :aria-label="mode === 'combat' ? 'Бой' : 'Сценарии главы'"
  >
    <EncounterTab
      v-if="mode === 'combat'"
      workspace
      :session-uuid="sessionUuid"
      :session="session"
      :participants="participants"
      :is-dm="isDm"
    />
    <SceneTab
      v-else-if="chapter"
      workspace
      contextual
      :session-uuid="sessionUuid"
      :arcs="arcs"
      :chapters="[chapter]"
      :current-chapter-id="session.currentChapterId"
      :requested-chapter-id="chapter.id"
      :is-dm="isDm"
      @scene-count="(...args) => $emit('scene-count', ...args)"
    />

    <button
      type="button"
      class="session-center-workspace-close"
      :aria-label="mode === 'combat' ? 'Закрыть бой' : 'Закрыть сценарии'"
      title="Закрыть"
      @click="$emit('close')"
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    </button>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import EncounterTab from '@/features/sessions/components/EncounterTab'
import SceneTab from '@/features/sessions/components/SceneTab.vue'

const props = defineProps({
  mode: { type: String, required: true },
  closing: { type: Boolean, default: false },
  sessionUuid: { type: String, required: true },
  session: { type: Object, required: true },
  participants: { type: Array, default: () => [] },
  isDm: { type: Boolean, default: false },
  chapter: { type: Object, default: null },
  arcs: { type: Array, default: () => [] },
})
defineEmits(['close', 'scene-count'])

const workspaceStyle = computed(() => ({
  '--session-workspace-header-left': props.chapter ? '252px' : '0px',
}))
</script>

<style scoped>
.session-center-workspace {
  --session-workspace-content-top: 172px;
  position: absolute;
  z-index: 12;
  top: 14px;
  right: var(--chapter-safe-right, 0px);
  bottom: 0;
  left: var(--chapter-safe-left, 0px);
  overflow: hidden;
  opacity: 1;
  pointer-events: none;
  transform: translateY(0);
  animation: session-workspace-in 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  transition: opacity 0.18s ease, transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);
}

.session-center-workspace::after {
  position: absolute;
  z-index: 30;
  top: var(--session-workspace-content-top);
  right: 0;
  left: 0;
  height: 36px;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--app-canvas-bg) 92%, transparent) 0%,
    color-mix(in srgb, var(--app-canvas-bg) 52%, transparent) 48%,
    transparent 100%
  );
  content: '';
  pointer-events: none;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  -webkit-mask-image: linear-gradient(180deg, var(--text-1) 0%, color-mix(in srgb, var(--text-1) 72%, transparent) 55%, transparent 100%);
  mask-image: linear-gradient(180deg, var(--text-1) 0%, color-mix(in srgb, var(--text-1) 72%, transparent) 55%, transparent 100%);
}

.session-center-workspace--closing {
  opacity: 0;
  transform: translateY(7px);
  animation: none;
}

.session-center-workspace :deep(.enc-wrap),
.session-center-workspace :deep(.scene-tab),
.session-center-workspace-close {
  pointer-events: auto;
}

.session-center-workspace-close {
  position: absolute;
  z-index: 40;
  top: 10px;
  right: 10px;
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface-raised) 92%, transparent);
  color: var(--text-2);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}

.session-center-workspace-close:hover {
  border-color: color-mix(in srgb, var(--danger) 48%, transparent);
  background: color-mix(in srgb, var(--danger) 12%, var(--surface-raised));
  color: var(--danger);
}

@keyframes session-workspace-in {
  from { opacity: 0; transform: translateY(9px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (prefers-reduced-motion: reduce) {
  .session-center-workspace { animation: none; transition-duration: 0.01ms; }
}

@media (max-width: 760px) {
  .session-center-workspace {
    top: 10px;
    right: 10px;
    bottom: 0;
    left: 10px;
  }
}
</style>
