<template>
  <aside class="global-map-callout" data-map-callout @pointerdown.stop>
    <button v-if="chapter" type="button" class="global-map-chapter" :title="`Открыть главу: ${chapter.name}`" @click="emit('chapter', chapter)">
      <img v-if="chapter.imageUrl" :src="chapter.imageUrl" alt="" draggable="false" loading="lazy" decoding="async" />
      <BookOpenText v-else :size="26" />
      <span><small>Глава {{ chapter.number }}</small><strong>{{ chapter.name }}</strong></span>
    </button>
    <strong class="global-map-point-name">{{ point.name || `Точка ${index + 1}` }}</strong>
    <small class="global-map-callout-route">{{ routeName }}</small>
    <p v-if="point.note" :title="point.note">{{ point.note }}</p>
  </aside>
</template>
<script setup>
import { BookOpenText } from '@lucide/vue'
defineProps({ point: Object, chapter: Object, routeName: String, index: Number })
const emit = defineEmits(['chapter'])
</script>
<style scoped>
.global-map-callout { width: 220px; max-width: calc(100vw - 32px); padding: 12px; box-sizing: border-box; color: var(--text-1); text-align: left; cursor: auto; }
.global-map-callout p { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-2); }
.global-map-callout-route { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 10px; }
.global-map-point-name { display: block; margin-bottom: 4px; font-size: 12px; }
.global-map-chapter { display: flex; align-items: center; gap: 8px; padding: 0; width: 100%; border: 0; background: none; color: inherit; text-align: left; font: inherit; cursor: pointer; margin-bottom: 7px; }
.global-map-chapter img { width: 56px; height: 42px; border-radius: 6px; object-fit: cover; }
.global-map-chapter span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.global-map-chapter small { color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
.global-map-chapter strong { font-size: 12px; line-height: 1.3; }
</style>
