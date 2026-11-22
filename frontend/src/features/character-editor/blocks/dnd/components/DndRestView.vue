<template>
  <RowActionMenu ref="menu" :anchor="anchor" block :trigger-attrs="{ style: { height: '100%', transform: embedded ? 'none' : undefined } }" title="Отдых и рассвет" :disabled="!interactive">
    <template #trigger="{ open }">
      <ActionButton v-if="header" variant="quiet" icon-only :disabled="!interactive" aria-label="Отдых и рассвет" title="Отдых и рассвет" aria-haspopup="menu" :aria-expanded="open"><template #icon><Moon :size="layoutTokens['sheet-header-action-icon']" /></template></ActionButton>
      <UtilityCell v-else-if="embedded" inline label="Отдых и рассвет" :disabled="!interactive" :active="open" aria-haspopup="menu" :aria-expanded="open">
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
import { ref } from 'vue'
import { ActionButton, ActionMenuItem, RowActionMenu } from '@sylvieshare/share-ui'
import { Coffee, Moon, Sunrise } from '@lucide/vue'
import UtilityCell from '@/features/character-editor/components/UtilityCell.vue'
import { layoutTokens } from '@/app/design-tokens'
defineProps({ interactive: { type: Boolean, default: false }, embedded: Boolean, header: Boolean, anchor: Object })
defineEmits(['short', 'long', 'dawn'])
const menu = ref(null)
defineExpose({ open: () => menu.value?.open(), close: () => menu.value?.close() })
</script>
<style scoped>
.rest-trigger { display: flex; width: 100%; height: 100%; min-height: 64px; gap: 5px; padding: 6px; }
</style>
