<template>
  <section class="es">
    <EditorSectionTitle v-if="title" :title="title"><slot name="actions" /></EditorSectionTitle>
    <slot />
  </section>
</template>

<script setup>
import EditorSectionTitle from '@/features/character-editor/components/EditorSectionTitle'

// A grouped block of fields inside an EditorPanel. The uppercase heading mirrors the stat-block
// section titles. Consecutive sections are separated by a divider automatically (`.es + .es`),
// so the first section never gets a top border — no per-consumer flags needed.
defineProps({
  title: { type: String, default: '' },
})
</script>

<style scoped>
.es { display: flex; flex-direction: column; gap: 10px; }
.es + .es { border-top: 1px solid var(--border); padding-top: 14px; }
</style>
