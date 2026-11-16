<template>
  <span class="npc-marker" :class="{'npc-marker--shadow':shadow}" :style="{ color: color || 'var(--text-2)' }">{{ letter || '—' }}</span>
</template>
<script setup>
defineProps({ letter: String, color: String, shadow:Boolean })
</script>
<style scoped>
.npc-marker { display: inline-grid; width: 24px; height: 20px; flex: 0 0 24px; place-items: center; font-family: var(--font-ui); font-size: 18px; font-weight: 850; line-height: 1; }
.npc-marker--shadow {text-shadow:0 1px 2px var(--bg),0 -1px 2px var(--bg),1px 0 2px var(--bg),-1px 0 2px var(--bg)}
</style>
