<template>
  <ActionMenuItem role="button" v-if="ctx.edition?.available" :icon="RefreshCw" :disabled="ctx.edition.busy" @click="show">Сменить редакцию</ActionMenuItem>
</template>
<script setup>
import { inject } from 'vue'
import { ActionMenuItem } from '@sylvieshare/share-ui'
import { RefreshCw } from '@lucide/vue'
const ctx = inject('charCtx', {})
const emit = defineEmits(['opened'])
function show() { ctx.edition.show(); if (ctx.edition.open) emit('opened') }
</script>
