<template>
  <div class="inventory-bag-item" :class="{ 'inventory-bag-item--source': source, 'inventory-bag-item--draggable': draggable }"
    role="button" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled" @keydown.enter.prevent="!disabled && $event.currentTarget.click()" @keydown.space.prevent="!disabled && $event.currentTarget.click()"
    :data-sortable-key="itemKey" :aria-label="name">
    <ItemIcon v-if="item?.iconImageUrl || item?.svg" :item="item" size="100%" :fallback-to-type="false" />
    <Package v-else :size="32" aria-hidden="true" />
    <span v-if="count > 1" class="inventory-bag-item__count">{{ count }}</span>
    <span v-if="status" class="inventory-bag-item__status" :title="status" aria-label="Статус предмета">●</span>
    <span class="inventory-bag-item__name">{{ name }}</span>
  </div>
</template>
<script setup>
import { Package } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
defineProps({ itemKey: String, item: Object, name: String, count: Number, source: Boolean, draggable: Boolean, status: String, disabled: Boolean })
</script>
<style scoped>
.inventory-bag-item { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 8px; box-sizing: border-box; color: var(--text-muted); cursor: pointer; }
.inventory-bag-item--draggable { cursor: grab; touch-action: none; }
.inventory-bag-item--draggable:active { cursor: grabbing; }
.inventory-bag-item--source { opacity: .25; }
.inventory-bag-item__count { position: absolute; right: 5px; bottom: 4px; padding: 1px 4px; border-radius: var(--r-sm); background: var(--surface); color: var(--text-1); font: 800 13px/1.2 var(--font-ui); pointer-events: none; }
.inventory-bag-item__status { position: absolute; left: 5px; top: 3px; color: var(--accent); font-size: 12px; }
.inventory-bag-item__name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
