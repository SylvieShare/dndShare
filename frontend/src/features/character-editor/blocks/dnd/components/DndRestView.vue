<template>
  <RowActionMenu block :trigger-attrs="{ style: { height: '100%', transform: embedded ? 'none' : undefined } }" title="Отдых и рассвет" :disabled="!interactive">
    <template #trigger="{ open }">
      <UtilityCell v-if="embedded" inline label="Отдых и рассвет" :disabled="!interactive" :active="open" aria-haspopup="menu" :aria-expanded="open">
        <template #icon><Moon :size="20" /></template>
        Отдых
      </UtilityCell>
      <ActionButton v-else class="rest-trigger" variant="quiet" :disabled="!interactive" aria-label="Отдых и рассвет">
        <template #icon><Moon :size="25" /></template>
        Отдых
      </ActionButton>
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
import { Coffee, Moon, Sunrise } from '@lucide/vue'
import UtilityCell from '@/features/character-editor/components/UtilityCell.vue'
defineProps({ interactive: { type: Boolean, default: false }, embedded: Boolean })
defineEmits(['short', 'long', 'dawn'])
</script>
<style scoped>
.rest-trigger { display: flex; width: 100%; height: 100%; min-height: 64px; gap: 5px; padding: 6px; }
</style>
