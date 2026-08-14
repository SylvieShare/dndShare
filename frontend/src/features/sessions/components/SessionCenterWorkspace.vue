<template>
  <section
    class="session-center-workspace"
    :class="{ 'session-center-workspace--closing': closing, 'session-center-workspace--without-chapter': !chapter }"
    :style="{ '--session-workspace-header-left': chapter ? '252px' : '0px' }"
    :aria-label="mode === 'combat' ? 'Бой' : 'Сценарии главы'"
  >
    <EncounterTab
      v-if="mode === 'combat'"
      workspace
      :session-uuid="sessionUuid"
      :session="session"
      :participants="participants"
      :is-dm="isDm"
      :encounter="encounter"
      @view-participant="$emit('view-participant', $event)"
    />
    <SceneGraphWorkspace
      v-else-if="chapter"
      :session-uuid="sessionUuid"
      :chapter="chapter"
      :is-dm="isDm"
      @exit="$emit('close')"
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
import EncounterTab from '@/features/sessions/components/EncounterTab'
import SceneGraphWorkspace from '@/features/sessions/components/SceneGraphWorkspace.vue'

defineProps({
  mode: { type: String, required: true },
  closing: { type: Boolean, default: false },
  sessionUuid: { type: String, required: true },
  session: { type: Object, required: true },
  participants: { type: Array, default: () => [] },
  isDm: { type: Boolean, default: false },
  encounter: { type: Object, required: true },
  chapter: { type: Object, default: null },
})
defineEmits(['close', 'scene-count', 'view-participant'])
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
  animation: session-workspace-in 0.21s cubic-bezier(0.22, 1, 0.36, 1) both;
  transition:
    opacity 0.18s ease,
    transform 0.24s cubic-bezier(0.22, 1, 0.36, 1),
    left 0.42s cubic-bezier(0.22, 1, 0.36, 1);
}

.session-center-workspace--closing {
  opacity: 0;
  transform: translateY(7px);
  animation: none;
}

.session-center-workspace :deep(.enc-wrap),
.session-center-workspace :deep(.scene-graph-workspace),
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
    top: 14px;
    right: 0;
    bottom: 0;
    left: 0;
  }
}
</style>
