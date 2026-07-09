<template>
  <div class="et"><slot /></div>
</template>

<script setup>
// Summary footer for editors (e.g. "КБ: 14 · со щитом: 16"). Wrap emphasised numbers in <strong>.
</script>

<style scoped>
.et { color: var(--text-muted); font-size: 12px; padding-top: 6px; border-top: 1px solid var(--border); }
.et :deep(strong) { color: var(--text-1); font-size: 14px; }
</style>
