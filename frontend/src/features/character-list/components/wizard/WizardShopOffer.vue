<template>
  <div class="shop-item">
    <ItemReferenceRow :item="item" :count="count" :params="item.params" roomy-weapon show-details
      @activate="$emit('details')" @details="$emit('details')">
      <template #icon><ItemIcon placeholder :type="itemType" :item="item" :size="64" /></template>
    </ItemReferenceRow>
    <button type="button" class="shop-add" :disabled="disabled" :aria-label="'Добавить ' + item.name"
      :title="disabled ? 'Не хватает монет' : 'Купить за ' + price" @click="$emit('buy')">
      <Plus :size="15" aria-hidden="true" /><slot name="price">{{ price }}</slot>
    </button>
  </div>
</template>
<script setup>
import { Plus } from '@lucide/vue'
import ItemReferenceRow from '@/features/items/components/ItemReferenceRow.vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
defineProps({ item: { type: Object, required: true }, itemType: Object, price: String, count: Number, disabled: Boolean })
defineEmits(['buy', 'details'])
</script>
