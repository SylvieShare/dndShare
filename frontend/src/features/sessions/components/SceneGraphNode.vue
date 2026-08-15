<template>
  <article class="scene-graph-node" :class="{ 'scene-graph-node--spotlight': spotlight }">
    <div class="scene-graph-node-visual">
      <img v-if="imageUrl" :src="imageUrl" alt="" draggable="false" />
      <span class="scene-graph-node-shade" />
      <span class="scene-graph-node-index">{{ String(index + 1).padStart(2, '0') }}</span>
      <svg v-if="!imageUrl" viewBox="0 0 236 94" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 C42 28 82 88 128 43 C166 7 199 58 236 20 V94 H0Z" fill="currentColor" opacity=".13"/>
        <path d="M0 78 C52 42 86 92 138 53 C177 23 207 60 236 37" fill="none" stroke="currentColor" opacity=".34" stroke-width="2"/>
      </svg>
    </div>
    <div class="scene-graph-node-copy">
      <div class="scene-graph-node-heading">
        <span>СЦЕНАРИЙ</span>
      </div>
      <strong>{{ scene.name }}</strong>
      <small>{{ context ? 'В контексте боя' : spotlight ? 'Двойной клик — к сценариям' : 'Двойной клик — открыть холст' }}</small>
    </div>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { sessionImagePresetUrl } from '@/features/sessions/lib/sessionImages'

const props = defineProps({
  scene: { type: Object, required: true },
  index: { type: Number, default: 0 },
  spotlight: { type: Boolean, default: false },
  context: { type: Boolean, default: false },
})

const imageUrl = computed(() => sessionImagePresetUrl(props.scene.imagePresetKey))
</script>

<style scoped>
.scene-graph-node {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border: 1px solid var(--border-strong);
  border-radius: 13px;
  background: var(--surface-raised);
  color: var(--accent-soft);
  box-shadow: var(--shadow-lg);
  user-select: none;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.scene-graph-node:hover { border-color: var(--accent); }
.scene-graph-node--spotlight { border-color: color-mix(in srgb, var(--accent) 68%, var(--border)); }
.scene-graph-node-visual {
  position: absolute;
  inset: 0 0 62px;
  overflow: hidden;
  background:
    radial-gradient(circle at 78% 15%, color-mix(in srgb, var(--accent) 25%, transparent), transparent 42%),
    linear-gradient(140deg, var(--surface-active), var(--surface-raised));
}
.scene-graph-node-visual img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.scene-graph-node-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(110deg, color-mix(in srgb, var(--bg) 58%, transparent), transparent 68%);
}
.scene-graph-node-visual svg { position: absolute; inset: auto 0 0; width: 100%; height: 94px; }
.scene-graph-node-index {
  position: absolute;
  z-index: 1;
  top: 12px;
  left: 14px;
  color: color-mix(in srgb, var(--text-1) 82%, transparent);
  font-family: var(--font-display);
  font-size: 30px;
  font-weight: 800;
  line-height: 1;
}
.scene-graph-node-copy {
  position: absolute;
  z-index: 2;
  right: 0;
  bottom: 0;
  left: 0;
  min-height: 62px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 7px 11px 8px;
  border-top: 1px solid color-mix(in srgb, var(--text-1) 13%, transparent);
  background: color-mix(in srgb, var(--bg) 68%, transparent);
  backdrop-filter: blur(12px);
}
.scene-graph-node-heading { display: flex; align-items: center; justify-content: space-between; gap: 6px; }
.scene-graph-node-heading > span { color: var(--accent-soft); font-size: 9px; font-weight: 850; letter-spacing: 0.09em; }
.scene-graph-node-copy strong {
  overflow: hidden;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 16px;
  line-height: 1.18;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.scene-graph-node-copy small { overflow: hidden; color: var(--text-muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
</style>
