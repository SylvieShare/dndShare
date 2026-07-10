<template>
  <SectionLabel :title="block.title" border :align="block.content.align || ''" />
</template>

<script setup>
import SectionLabel from '@/shared/ui/SectionLabel'

defineProps(['block'])
</script>
