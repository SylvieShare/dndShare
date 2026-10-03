<template>
  <div v-if="resources.length" class="weapon-linked-charges">
    <ItemResourcePips v-for="resource in resources" :key="resource.key" :resource="resource" :interactive="interactive"
      :label="resources.length > 1 ? resource.title : undefined" @toggle="$emit('toggle', resource, $event)" />
  </div>
</template>
<script setup>
import ItemResourcePips from './ItemResourcePips.vue'
defineProps({ resources: { type: Array, default: () => [] }, interactive: Boolean })
defineEmits(['toggle'])
</script>
<style scoped>
.weapon-linked-charges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px 10px; }
</style>
