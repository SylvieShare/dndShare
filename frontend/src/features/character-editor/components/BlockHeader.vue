<template>
  <div class="block-header">
    <span class="block-header-title">{{ title }}</span>
    <slot name="actions" />
  </div>
</template>

<script>
export default {
  name: 'BlockHeader',
  props: ['title'],
}
</script>

<style scoped>
.block-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
