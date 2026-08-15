<template>
  <SectionLabel :title="block.title" border :align="block.content.align || ''" />
</template>

<script setup>
import { SectionLabel } from '@sylvieshare/share-ui'

defineProps(['block'])
</script>
