<template>
  <article class="scene-graph-node" :class="{ 'scene-graph-node--spotlight': spotlight }">
    <div class="scene-graph-node-visual">
      <img v-if="imageUrl" :src="imageUrl" alt="" draggable="false" />
      <span class="scene-graph-node-shade" />
      <span v-if="scene.status && scene.status !== 'none'" class="scene-graph-node-status" :style="{ color: status.color }">{{ status.label }}</span>
      <svg v-if="!imageUrl" viewBox="0 0 236 94" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 70 C42 28 82 88 128 43 C166 7 199 58 236 20 V94 H0Z" fill="currentColor" opacity=".13"/>
        <path d="M0 78 C52 42 86 92 138 53 C177 23 207 60 236 37" fill="none" stroke="currentColor" opacity=".34" stroke-width="2"/>
      </svg>
    </div>
    <div class="scene-graph-node-copy">
      <strong>{{ scene.name }}</strong>
      <small>{{ spotlight ? 'Двойной клик — к сценариям' : 'Двойной клик — открыть холст' }}</small>
    </div>
  </article>
</template>

<script setup>
import { computed, inject } from 'vue'
import { sessionImageUrl } from '@/features/sessions/lib/sessionImages'
import { sceneStatus } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  scene: { type: Object, required: true },
  spotlight: { type: Boolean, default: false },
})

const sessionWorld = inject('sessionWorld', null)
const imageUrl = computed(() => {
  if (props.scene.imageId || !props.scene.locationId) return sessionImageUrl(props.scene)
  const location = sessionWorld?.locationsById.value.get(Number(props.scene.locationId))
  if (location) return sessionImageUrl(location)
  return sessionWorld?.loaded.value ? '' : sessionImageUrl(props.scene)
})
const status = computed(() => sceneStatus(props.scene.status))
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
  inset: 0;
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
.scene-graph-node-status {
  position: absolute;
  z-index: 1;
  top: 8px;
  right: 8px;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
  border-radius: 5px;
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .06em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
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
  border-radius: 0 0 12px 12px;
  background: color-mix(in srgb, var(--bg) 58%, transparent);
  backdrop-filter: blur(12px) saturate(1.15);
  -webkit-backdrop-filter: blur(12px) saturate(1.15);
}
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
