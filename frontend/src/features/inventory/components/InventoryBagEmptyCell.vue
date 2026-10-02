<template>
  <RowActionMenu block related :disabled="disabled" title="Добавить предмет">
    <template #trigger="{ open }">
      <button type="button" class="inventory-bag-add" :class="{ 'inventory-bag-add--open': open }" :disabled="disabled"
        :aria-label="`Добавить предмет в ячейку ${index + 1}`" :aria-expanded="open" aria-haspopup="menu">
        <Backpack class="inventory-bag-add__bag" :size="28" aria-hidden="true" />
        <Plus class="inventory-bag-add__plus" :size="28" aria-hidden="true" />
      </button>
    </template>
    <template #default="{ close }">
      <RowActionItem :icon="BookOpen" @click="choose('add-catalog', close)">Добавить из справочника</RowActionItem>
      <RowActionItem :icon="Plus" @click="choose('add-custom', close)">Добавить своё</RowActionItem>
    </template>
  </RowActionMenu>
</template>
<script setup>
import { Backpack, BookOpen, Plus } from '@lucide/vue'
import { RowActionMenu } from '@sylvieshare/share-ui'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
defineProps({ index: Number, disabled: Boolean })
const emit = defineEmits(['add-catalog', 'add-custom'])
function choose(action, close) { close(); emit(action) }
</script>
<style scoped>
.inventory-bag-add { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 0; border: 0; border-radius: inherit; background: none; color: var(--text-muted); cursor: pointer; }
.inventory-bag-add__bag { opacity: .25; }
.inventory-bag-add__plus { position: absolute; opacity: 0; color: var(--accent); }
.inventory-bag-add:hover:not(:disabled) .inventory-bag-add__bag,
.inventory-bag-add:focus-visible .inventory-bag-add__bag,
.inventory-bag-add--open .inventory-bag-add__bag { opacity: 0; }
.inventory-bag-add:hover:not(:disabled) .inventory-bag-add__plus,
.inventory-bag-add:focus-visible .inventory-bag-add__plus,
.inventory-bag-add--open .inventory-bag-add__plus { opacity: 1; }
.inventory-bag-add:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
.inventory-bag-add:disabled { cursor: default; }
</style>
