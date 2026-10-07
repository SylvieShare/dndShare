<template>
  <span
    v-if="count"
    class="map-model-light-badge"
    role="img"
    :aria-label="`Встроенный свет: ${count}`"
    :title="`Встроенный свет: ${count}`"
    ><Lightbulb :size="14"
  /></span>
</template>
<script setup>
import { Lightbulb } from "@lucide/vue";
defineProps({ count: Number });
</script>
<style scoped>
.map-model-light-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-soft);
}
</style>
