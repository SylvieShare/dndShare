<template>
  <ItemTooltip v-if="tooltip.visible" :anchor="tooltip.anchor" :title="tooltip.name" :desc="tooltip.desc">
    <template v-if="tooltip.item && (tooltip.item.data?.cost || tooltip.item.data?.weight != null)" #details>
      <ItemTooltipDetails :item="tooltip.item" />
    </template>
  </ItemTooltip>
</template>
<script setup>
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import ItemTooltipDetails from '@/features/items/detail-components/ItemTooltipDetails.vue'
defineProps({ tooltip: { type: Object, required: true } })
</script>
