<template>
  <LoadingIndicator label="Загрузка трека" :size="size" aria-hidden="true" />
</template>

<script setup>
import { LoadingIndicator } from '@sylvieshare/share-ui'
defineProps({ size: { type: Number, default: 14 } })
</script>
