<template>
  <h2 class="sheet-section-title">{{ title }}</h2>
  <img v-if="cover && failedCover !== cover" class="creation-cover" :src="cover" alt="" @error="failedCover = cover" />
</template>

<script setup>
import { ref } from 'vue'
defineProps({ title: String, cover: String })
const failedCover = ref('')
</script>

<style scoped>
.sheet-section-title { margin: 0; }
.creation-cover {
  display: block;
  width: 100%;
  height: clamp(112px, 22vw, 240px);
  object-fit: cover;
  border-radius: var(--radius-large);
}
</style>
