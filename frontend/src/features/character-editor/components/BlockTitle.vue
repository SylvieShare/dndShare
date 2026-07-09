<template>
  <div class="block-title">{{ title }}</div>
</template>

<script>
export default {
  name: "BlockTitle",
  props: ['title'],
}
</script>

<style scoped>
.block-title {
  color: #7a7a86;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
</style>
