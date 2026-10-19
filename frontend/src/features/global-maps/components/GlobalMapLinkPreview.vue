<template>
  <span class="global-map-link-preview">
    <img v-if="item.imageUrl" :src="item.imageUrl" alt="" loading="lazy" decoding="async" draggable="false" />
    <span v-else class="global-map-link-placeholder"><BookOpenText v-if="kind === 'chapter'" :size="20" /><MapPin v-else :size="20" /></span>
    <span class="global-map-link-text"><small>{{ kind === 'chapter' ? `Глава ${item.number}` : 'Локация' }}</small><strong>{{ item.name }}</strong></span>
  </span>
</template>
<script setup>
import { BookOpenText, MapPin } from '@lucide/vue'
defineProps({ item: Object, kind: String })
</script>
<style scoped>
.global-map-link-preview { display: flex; align-items: center; gap: 9px; min-width: 0; flex: 1; }
.global-map-link-preview img, .global-map-link-placeholder { flex: none; width: 40px; height: 34px; border-radius: 5px; object-fit: cover; }
.global-map-link-placeholder { display: grid; place-items: center; background: var(--surface-raised); color: var(--accent-soft); }
.global-map-link-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.global-map-link-text small { color: var(--text-muted); font-size: 9px; font-weight: 500; text-transform: uppercase; letter-spacing: .06em; }
.global-map-link-text strong { color: var(--text-1); font-size: 12px; font-weight: 600; line-height: 1.3; overflow-wrap: anywhere; }
</style>
