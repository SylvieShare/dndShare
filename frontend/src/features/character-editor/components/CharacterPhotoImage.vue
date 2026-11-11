<template>
  <div class="character-photo-image" :class="'character-photo-image--' + fit">
    <SkeletonBlock v-if="!loaded && !failed" width="100%" height="100%" />
    <img v-if="!failed" :key="attempt" :src="src" :alt="alt" loading="lazy" draggable="false" :class="{ loaded }" @load="loaded = true" @error="failed = true" />
    <div v-else class="photo-unavailable" role="img" aria-label="Фотография недоступна">
      <ImageOff :size="24" aria-hidden="true" />
      <ActionButton v-if="retryable" variant="secondary" @click="retry">Повторить загрузку</ActionButton>
    </div>
  </div>
</template>
<script setup>
import { ref, watch } from 'vue'
import { ActionButton, SkeletonBlock } from '@sylvieshare/share-ui'
import { ImageOff } from '@lucide/vue'
const props = defineProps({ src: String, alt: String, fit: { type: String, default: 'cover' }, retryable: Boolean })
const loaded = ref(false), failed = ref(false), attempt = ref(0)
function retry() { loaded.value = false; failed.value = false; attempt.value++ }
watch(() => props.src, retry)
</script>
<style scoped>
.character-photo-image { position:relative;width:100%;height:100%;min-height:0;display:grid;place-items:center;overflow:hidden }
.character-photo-image > * { grid-area:1/1 }
.character-photo-image img { width:100%;height:100%;min-height:0;object-fit:cover;opacity:0;transition:opacity .18s }
.character-photo-image img.loaded { opacity:1 }
.character-photo-image--contain img { object-fit:contain }
.photo-unavailable { display:grid;justify-items:center;gap:var(--spacing-medium);color:var(--text-muted);padding:var(--spacing-small) }
@media (prefers-reduced-motion:reduce) { .character-photo-image img { transition:none } }
</style>
