<template>
  <div class="est">
    <span class="est-text">{{ title }}</span>
    <slot />
  </div>
</template>

<script setup>
// Shared uppercase mini-heading for morph editor sections (Значение / Спасбросок / Навыки /
// Способности …). One style instead of per-editor `.se-head` / `.abe-head` / `.bte-sec-title`
// copies. The default slot holds trailing controls (e.g. a section RemoveButton).
defineProps({
  title: { type: String, default: '' },
})
</script>

<style scoped>
.est {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.est-text { min-width: 0; }
</style>
