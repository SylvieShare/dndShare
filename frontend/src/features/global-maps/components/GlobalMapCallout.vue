<template>
  <aside class="global-map-callout" data-map-callout @pointerdown.stop>
    <button v-if="chapter" type="button" class="global-map-chapter" :title="`Открыть главу: ${chapter.name}`" @click="emit('chapter', chapter)">
      <img v-if="chapter.imageUrl" :src="chapter.imageUrl" alt="" draggable="false" loading="lazy" decoding="async" />
      <BookOpenText v-else :size="26" />
      <span><small>Глава {{ chapter.number }}</small><strong>{{ chapter.name }}</strong></span>
    </button>
    <strong v-if="point.name" class="global-map-point-name">{{ point.name }}</strong>
    <p v-if="point.note" :title="point.note">{{ point.note }}</p>
  </aside>
</template>
<script setup>
import { BookOpenText } from '@lucide/vue'
defineProps({ point: Object, chapter: Object })
const emit = defineEmits(['chapter'])
</script>
<style scoped>
.global-map-callout { position: absolute; left: 40px; bottom: 34px; width: 190px; padding: 10px; border: 1px solid color-mix(in srgb, var(--route-color) 45%, var(--border)); border-radius: 10px; background: color-mix(in srgb, var(--surface) 96%, transparent); box-shadow: var(--shadow-sm); color: var(--text-1); text-align: left; cursor: auto; }
.global-map-callout::before { position: absolute; left: -30px; bottom: -17px; width: 34px; height: 1px; background: var(--route-color); content: ''; transform: rotate(-38deg); }
.global-map-callout p { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-2); }
.global-map-point-name { display: block; margin-bottom: 4px; font-size: 12px; }
.global-map-chapter { display: flex; align-items: center; gap: 8px; padding: 0; width: 100%; border: 0; background: none; color: inherit; text-align: left; font: inherit; cursor: pointer; margin-bottom: 7px; }
.global-map-chapter img { width: 56px; height: 42px; border-radius: 6px; object-fit: cover; }
.global-map-chapter span { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.global-map-chapter small { color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
.global-map-chapter strong { font-size: 12px; line-height: 1.3; }
</style>
