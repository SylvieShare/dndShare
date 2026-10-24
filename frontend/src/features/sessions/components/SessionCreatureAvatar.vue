<template>
  <div class="p-avatar" :class="{ 'p-avatar--icon': icon }" :style="{ color, background: url || svg ? 'transparent' : background }">
    <img v-if="url" :src="url" class="ava-img" alt="" draggable="false" />
    <span v-else-if="svg" class="ava-svg" v-html="svg" />
    <span v-else-if="name" class="ava-initial">{{ name.charAt(0).toUpperCase() }}</span>
    <ImageIcon v-else :size="24" :stroke-width="1.4" aria-hidden="true" />
  </div>
</template>
<script setup>
import { Image as ImageIcon } from '@lucide/vue'
defineProps({ name: String, url: String, svg: String, icon: Boolean, color: String, background: String })
</script>
<style scoped>
.p-avatar { flex: 0 0 64px; width: 64px; height: 64px; border-radius: 50%; display: grid; place-items: center; overflow: hidden; }
.p-avatar--icon { border-radius: 0; }
.ava-img { width: 100%; height: 100%; object-fit: cover; object-position: top center; mask-image: radial-gradient(ellipse 82% 84% at 50% 44%, var(--text-on-accent) 54%, transparent 100%); }
.p-avatar--icon .ava-img { object-fit: contain; object-position: center; mask-image: none; }
.ava-svg { display: flex; width: 100%; height: 100%; }
.ava-svg :deep(svg) { width: 100%; height: 100%; }
.ava-initial { font-size: 16px; font-weight: 700; color: var(--text-on-accent); }
</style>
