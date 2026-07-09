<template>
  <div class="section-header" :style="block.content.align ? { textAlign: block.content.align } : {}">{{ block.title }}</div>
</template>

<script setup>
defineProps(['block'])
</script>

<style scoped>
.section-header {
  color: #7a7a86;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding-bottom: 5px;
  border-bottom: 1px solid #2a2a2e;
  margin-bottom: 6px;
}
</style>
