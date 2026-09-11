<template>
  <RowActionMenu block title="Отдых и рассвет" :disabled="!interactive">
    <template #trigger>
      <ActionButton class="rest-trigger" variant="quiet" :disabled="!interactive" aria-label="Отдых и рассвет"><Moon :size="25" /><span>Отдых</span><ChevronDown :size="14" /></ActionButton>
    </template>
    <template #default="{ close }">
      <ActionMenuItem :icon="Coffee" @click="close(); $emit('short')">Короткий отдых</ActionMenuItem>
      <ActionMenuItem :icon="Moon" @click="close(); $emit('long')">Длинный отдых</ActionMenuItem>
      <ActionMenuItem :icon="Sunrise" @click="close(); $emit('dawn')">Рассвет</ActionMenuItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { ActionButton, ActionMenuItem, RowActionMenu } from '@sylvieshare/share-ui'
import { Coffee, Moon, Sunrise, ChevronDown } from '@lucide/vue'
defineProps({ interactive: { type: Boolean, default: false } })
defineEmits(['short', 'long', 'dawn'])
</script>
<style scoped>
.rest-trigger { width: 100%; height: 100%; min-height: 64px; gap: 5px; padding: 6px; flex-wrap: wrap; }
</style>
