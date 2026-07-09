<template>
  <div class="ep" :class="{ 'ep--compact': compact }">
    <div v-if="title" class="ep-title">{{ title }}</div>
    <slot />
  </div>
</template>

<script setup>
// Shared outer shell for morph-window / modal editors. Gives every editor the same padding,
// vertical rhythm and title style. Compose with EditorSection (grouped fields + dividers) and
// EditorTotal (summary footer). Use `compact` for CalcPad-driven editors (HP / money / level).
defineProps({
  title: { type: String, default: '' },
  compact: { type: Boolean, default: false },
})
</script>

<style scoped>
.ep { padding: 18px 18px 20px; display: flex; flex-direction: column; gap: 12px; }
.ep--compact { padding: 16px 18px 18px; }
.ep-title { color: var(--text-1); font-size: 16px; font-weight: 700; }
</style>
