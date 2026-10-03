<template>
  <div ref="element" class="inventory-bag-item action-menu-source" :class="{ 'inventory-bag-item--source': source, 'inventory-bag-item--draggable': draggable }"
    role="button" :tabindex="disabled ? -1 : 0" :aria-disabled="disabled" @keydown.enter.prevent="!disabled && $event.currentTarget.click()" @keydown.space.prevent="!disabled && $event.currentTarget.click()"
    :data-sortable-key="itemKey" :aria-label="name" :aria-description="description || undefined">
    <span class="inventory-bag-item__art" aria-hidden="true">
      <ItemIcon v-if="item?.iconImageUrl || item?.svg" :item="item" size="100%" :fallback-to-type="false" />
      <Package v-else :size="32" aria-hidden="true" />
    </span>
    <span v-if="feedback" :key="feedback.token" class="inventory-bag-item__feedback"
      :class="{ 'inventory-bag-item__feedback--add': feedback.amount > 0 }" aria-hidden="true">{{ feedback.amount > 0 ? '+' : '−' }}{{ Math.abs(feedback.amount) }}</span>
    <div v-if="wearable || usable || count > 1" class="inventory-bag-item__footer">
      <span v-if="wearable || usable" class="inventory-bag-item__tags" aria-hidden="true">
        <span v-if="wearable" :title="equipped ? 'Надето' : 'Можно надеть'" :class="{ 'inventory-bag-item__tag--equipped': equipped }"><Shirt :size="12" /></span>
        <span v-if="usable" title="Можно использовать"><Hand :size="12" /></span>
      </span>
      <span v-if="count > 1" class="inventory-bag-item__count" :title="`Количество: ${count}`" aria-hidden="true">{{ count }}</span>
    </div>
    <span v-if="status" class="inventory-bag-item__status" :title="status" aria-label="Статус предмета">●</span>
    <span class="inventory-bag-item__name">{{ name }}</span>
  </div>
</template>
<script setup>
import { computed, ref } from 'vue'
import { Hand, Package, Shirt } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import { useInventoryQuantityMotion } from '../composables/useInventoryQuantityMotion'
const props = defineProps({ itemKey: [String, Number], item: Object, name: String, count: Number, source: Boolean, draggable: Boolean, status: String, disabled: Boolean, equipped: Boolean, simplified: Boolean, wearable: Boolean, usable: Boolean })
const element = ref(null)
const feedback = useInventoryQuantityMotion(element, props)
const description = computed(() => [
  props.simplified && 'Упрощённый предмет',
  (props.equipped && 'Экипировано') || (props.wearable && 'Можно надеть'),
  props.usable && 'Можно использовать',
  props.count > 1 && `Количество: ${props.count}`,
  props.status,
].filter(Boolean).join('. '))
</script>
<style scoped>
.inventory-bag-item { position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; padding: 8px; box-sizing: border-box; color: var(--text-muted); cursor: pointer; border-radius: var(--r-lg); }
.inventory-bag-item.action-menu-source--open { transform: none; }
.inventory-bag-item--draggable { cursor: grab; touch-action: none; }
.inventory-bag-item--draggable:active { cursor: grabbing; }
.inventory-bag-item--source { opacity: .25; }
.inventory-bag-item__art { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; pointer-events: none; }
.inventory-bag-item__feedback { position: absolute; right: 8px; bottom: 24px; color: var(--danger); font: 800 14px/1 var(--font-ui); text-shadow: 0 1px 3px var(--scrim); pointer-events: none; z-index: 2; }
.inventory-bag-item__feedback--add { color: var(--success); }
.inventory-bag-item__footer { position: absolute; inset: auto 0 0; display: flex; align-items: flex-end; justify-content: flex-end; gap: 4px; pointer-events: none; }
.inventory-bag-item__count, .inventory-bag-item__tags { min-height: 22px; box-sizing: border-box; background: var(--surface-raised); box-shadow: inset 0 0 0 1px var(--border); }
.inventory-bag-item__count { min-width: 22px; padding: 4px 5px 3px; border-radius: var(--r-md) 0 var(--r-lg) 0; color: var(--text-1); font: 800 12px/15px var(--font-ui); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; pointer-events: auto; }
.inventory-bag-item__tags { display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0; margin-right: auto; padding: 4px 5px; border-radius: 0 var(--r-md) 0 var(--r-lg); color: var(--text-muted); }
.inventory-bag-item__tags > span { display: flex; pointer-events: auto; }
.inventory-bag-item__tag--equipped { color: var(--accent); }
.inventory-bag-item__status { position: absolute; left: 5px; top: 3px; color: var(--accent); font-size: 12px; }
.inventory-bag-item__name { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
</style>
