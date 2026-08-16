<template>
  <article
    class="chapter-node"
    :class="[
      `chapter-node--${status.tone}`,
      {
        'chapter-node--current': current,
        'chapter-node--linking': linking,
        'chapter-node--target': target,
        'chapter-node--spotlight': spotlight,
        'chapter-node--suppressed': suppressed,
        'chapter-node--dragging': dragging,
      },
    ]"
    :style="nodeStyle"
    :data-chapter-id="chapter.id"
    :aria-hidden="suppressed ? 'true' : undefined"
    @pointerdown="$emit('pointerdown', $event, chapter)"
  >
    <div class="chapter-node-image">
      <img v-if="imageUrl" :src="imageUrl" alt="" draggable="false" :style="imageStyle" />
      <div v-else class="chapter-node-image-empty" />
      <div class="chapter-node-shade" />
      <span v-if="current" class="chapter-current-mark">Сейчас здесь</span>
      <span v-if="chapter.status && chapter.status !== 'none'" class="chapter-status" :class="`chapter-status--${status.tone}`" :style="{ color: status.color }">{{ status.label }}</span>
    </div>
    <div class="chapter-node-copy">
      <div class="chapter-node-meta">
        <span class="chapter-node-number">Глава {{ chapter.number }}</span>
        <span v-if="chapter.sceneCount" class="chapter-node-scenes">{{ sceneLabel }}</span>
      </div>
      <span class="chapter-node-name">{{ chapter.name }}</span>
    </div>
    <button
      v-if="showLinkPort"
      type="button"
      class="chapter-link-port"
      :disabled="spotlight || suppressed"
      :tabindex="spotlight || suppressed ? -1 : 0"
      :title="linking ? 'Отменить создание перехода' : 'Создать переход отсюда'"
      @pointerdown.stop
      @click.stop="$emit('start-link', chapter)"
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </article>
</template>

<script setup>
import { computed } from 'vue'
import { chapterImageUrl, chapterStatus } from '@/features/sessions/lib/chapterGraph'

const props = defineProps({
  chapter: { type: Object, required: true },
  current: { type: Boolean, default: false },
  linking: { type: Boolean, default: false },
  target: { type: Boolean, default: false },
  presentation: { type: Object, default: null },
  spotlight: { type: Boolean, default: false },
  suppressed: { type: Boolean, default: false },
  dragging: { type: Boolean, default: false },
  embedded: { type: Boolean, default: false },
  showLinkPort: { type: Boolean, default: true },
})
defineEmits(['pointerdown', 'start-link'])

const status = computed(() => chapterStatus(props.chapter.status))
const imageUrl = computed(() => chapterImageUrl(props.chapter))
const nodeStyle = computed(() => {
  if (props.embedded) return undefined
  const position = props.presentation ?? {
    x: props.chapter.positionX,
    y: props.chapter.positionY,
    scale: 1,
  }
  return {
    transform: `translate(${position.x}px, ${position.y}px) scale(${position.scale ?? 1})`,
  }
})
const imageStyle = computed(() => ({
  objectPosition: `${props.chapter.imageFocalX * 100}% ${props.chapter.imageFocalY * 100}%`,
}))
const sceneLabel = computed(() => {
  const count = props.chapter.sceneCount
  const tail = count % 100
  const word = tail >= 11 && tail <= 14
    ? 'сцен'
    : count % 10 === 1 ? 'сцена' : count % 10 >= 2 && count % 10 <= 4 ? 'сцены' : 'сцен'
  return `${count} ${word}`
})
</script>

<style scoped>
.chapter-node {
  position: absolute;
  top: 0;
  left: 0;
  width: 236px;
  height: 156px;
  overflow: visible;
  border: 1px solid var(--border-strong);
  border-radius: 13px;
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  cursor: grab;
  user-select: none;
  touch-action: none;
  transform-origin: top left;
  transition:
    transform 0.42s cubic-bezier(0.22, 1, 0.36, 1),
    opacity 0.24s ease,
    border-color 0.15s,
    box-shadow 0.15s,
    filter 0.24s ease;
}

.chapter-node:active { cursor: grabbing; }
.chapter-node:hover { border-color: var(--surface-active); box-shadow: var(--shadow-lg); }
.chapter-node--current {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent), var(--shadow-lg);
}
.chapter-node--linking { border-color: var(--warning); }
.chapter-node--target { border-color: var(--success); cursor: crosshair; }
.chapter-node--completed { filter: saturate(0.72); }
.chapter-node--dragging {
  transition-property: opacity, border-color, box-shadow, filter;
  transition-duration: 0.24s, 0.15s, 0.15s, 0.24s;
}
.chapter-node--spotlight { z-index: 10; cursor: default; }
.chapter-node--spotlight:active { cursor: default; }
.chapter-node--suppressed {
  opacity: 0;
  filter: blur(8px) saturate(0.65);
  pointer-events: none;
}
.chapter-node--spotlight .chapter-link-port,
.chapter-node--suppressed .chapter-link-port { opacity: 0; pointer-events: none; }

.chapter-node-image {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 12px;
  background: var(--surface-raised);
}

.chapter-node-image img,
.chapter-node-image-empty {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  pointer-events: none;
}

.chapter-node-image-empty {
  background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 20%, var(--surface)), var(--surface-raised));
}

.chapter-node-shade {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg) 38%, transparent) 0%, transparent 38%),
    linear-gradient(180deg, transparent 42%, color-mix(in srgb, var(--bg) 88%, transparent) 100%);
}

.chapter-current-mark,
.chapter-status {
  position: absolute;
  top: 8px;
  border-radius: 5px;
  padding: 3px 7px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  backdrop-filter: blur(8px);
}

.chapter-current-mark {
  left: 8px;
  color: var(--text-on-accent);
  background: var(--accent);
}

.chapter-status {
  right: 8px;
  color: var(--text-2);
  background: color-mix(in srgb, var(--bg) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--text-on-accent) 10%, transparent);
}
.chapter-node-copy {
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
  gap: 3px;
  overflow: hidden;
  padding: 9px 12px 10px;
  border-top: 1px solid color-mix(in srgb, var(--text-1) 13%, transparent);
  border-radius: 0 0 12px 12px;
  background: color-mix(in srgb, var(--bg) 58%, transparent);
  backdrop-filter: blur(12px) saturate(1.15);
  -webkit-backdrop-filter: blur(12px) saturate(1.15);
}

.chapter-node-meta {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chapter-node-number {
  color: var(--accent-soft);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.chapter-node-scenes {
  flex: none;
  color: color-mix(in srgb, var(--text-1) 68%, transparent);
  font-size: 9px;
  font-weight: 700;
}

.chapter-node-name {
  overflow: hidden;
  color: var(--text-1);
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
  text-overflow: ellipsis;
  text-shadow: 0 1px 8px color-mix(in srgb, var(--bg) 75%, transparent);
  white-space: nowrap;
}

.chapter-link-port {
  position: absolute;
  z-index: 3;
  top: 50%;
  right: -13px;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  background: var(--surface-raised);
  color: var(--text-muted);
  cursor: crosshair;
  opacity: 0;
  transform: translateY(-50%);
  transition: opacity 0.15s, color 0.15s, border-color 0.15s;
}

.chapter-node:hover .chapter-link-port,
.chapter-node--linking .chapter-link-port,
.chapter-node--target .chapter-link-port { opacity: 1; }
.chapter-link-port:hover { color: var(--accent); border-color: var(--accent); }
.chapter-link-port:disabled { cursor: default; }

@media (prefers-reduced-motion: reduce) {
  .chapter-node { transition-duration: 0.01ms; }
}
</style>
