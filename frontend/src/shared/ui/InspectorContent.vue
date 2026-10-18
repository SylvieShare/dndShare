<template>
  <div class="inspector-content">
    <div class="inspector-heading"><slot name="heading" /></div>
    <div class="inspector-body"><slot /></div>
  </div>
</template>
<style scoped>
.inspector-content { min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.inspector-heading { flex: none; padding: var(--inspector-inset, 14px) var(--inspector-inset, 14px) 0; margin-bottom: 12px; }
.inspector-body { min-height: 0; overflow: auto; display: flex; flex-direction: column; gap: 25px; padding: 0 var(--inspector-inset, 14px) var(--inspector-inset, 14px); }
.inspector-body > :deep(*) { flex-shrink: 0; }
</style>
