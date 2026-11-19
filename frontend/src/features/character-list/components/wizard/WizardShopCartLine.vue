<template>
  <div class="cart-item">
    <button class="cart-name" type="button" @click="$emit('details')">
      <ItemIcon placeholder :type="itemType" :item="item" :size="30" />{{ name || item.name }}
    </button>
    <span class="cart-price"><slot name="price">{{ price }}</slot></span>
    <div class="cart-quantity"><slot name="quantity" /></div>
    <button class="cart-remove" type="button" aria-label="Убрать" @click="$emit('remove')"><X :size="14" /></button>
    <div v-if="$slots.default" class="cart-options"><slot /></div>
  </div>
</template>
<script setup>
import { X } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
defineProps({ item: { type: Object, required: true }, name: String, itemType: Object, price: String })
defineEmits(['details', 'remove'])
</script>
