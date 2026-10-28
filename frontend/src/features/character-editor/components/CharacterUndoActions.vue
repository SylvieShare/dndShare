<template>
  <template v-if="ctx.canEdit ?? ctx.ownerMode">
    <ActionMenuItem role="button" :icon="Undo2" :disabled="!ctx.historyState?.canUndo" @click="ctx.undo?.()">Отменить изменение</ActionMenuItem>
    <ActionMenuItem role="button" :icon="Redo2" :disabled="!ctx.historyState?.canRedo" @click="ctx.redo?.()">Повторить изменение</ActionMenuItem>
  </template>
</template>
<script setup>
import { inject } from 'vue'
import { ActionMenuItem } from '@sylvieshare/share-ui'
import { Undo2, Redo2 } from '@lucide/vue'
const ctx = inject('charCtx', {})
</script>
