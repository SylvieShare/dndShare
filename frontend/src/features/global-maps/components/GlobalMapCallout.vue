<template>
  <aside class="global-map-callout" data-map-callout @pointerdown.stop>
    <div class="global-map-callout-links">
      <button v-for="chapter in chapters" :key="`chapter-${chapter.id}`" type="button" class="global-map-chapter" :aria-label="`Открыть главу: ${chapter.name}`" @click="emit('chapter', chapter)"><GlobalMapLinkPreview :item="chapter" kind="chapter" /></button>
      <button v-for="location in locations" :key="`location-${location.id}`" type="button" class="global-map-chapter" :aria-label="`Открыть локацию: ${location.name}`" @click="emit('location', location)"><GlobalMapLinkPreview :item="location" kind="location" /></button>
    </div>
    <strong class="global-map-point-name">{{ point.name || `Точка ${index + 1}` }}</strong>
    <small class="global-map-callout-route">{{ routeName }}</small>
    <p v-if="point.note" :title="point.note">{{ point.note }}</p>
  </aside>
</template>
<script setup>
import GlobalMapLinkPreview from './GlobalMapLinkPreview.vue'
defineProps({ point: Object, chapters: Array, locations: Array, routeName: String, index: Number })
const emit = defineEmits(['chapter', 'location'])
</script>
<style scoped>
.global-map-callout { width: 220px; max-width: calc(100vw - 32px); padding: 12px; box-sizing: border-box; color: var(--text-1); text-align: left; cursor: auto; }
.global-map-callout p { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; white-space: pre-wrap; margin: 0; font-size: 12px; line-height: 1.5; color: var(--text-2); }
.global-map-callout-route { display: block; margin-bottom: 6px; color: var(--text-muted); font-size: 10px; }
.global-map-point-name { display: block; margin-bottom: 4px; font-size: 12px; }
.global-map-chapter { display: flex; align-items: center; gap: 8px; padding: 0; width: 100%; border: 0; background: none; color: inherit; text-align: left; font: inherit; cursor: pointer; margin-bottom: 7px; }
.global-map-callout-links { max-height: min(280px, 40dvh); overflow-y: auto; }
</style>
