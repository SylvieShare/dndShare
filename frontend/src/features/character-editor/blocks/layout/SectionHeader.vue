<template>
  <SectionLabel
    :title="block.title"
    :border="block.content.variant !== 'divider'"
    :divider="block.content.variant === 'divider'"
    :align="block.content.align || ''"
  />
</template>

<script setup>
import SectionLabel from '@/shared/ui/SectionLabel'

defineProps(['block'])
</script>
