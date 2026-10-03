<template>
  <ItemMechanicPanel v-for="panel in panels" :key="panel.key" kind="rule" :title="panel.title">
    <DndRichContent :html="panel.description" :item="panel.item" />
    <MechanicTheses :lines="panel.requirements" />
  </ItemMechanicPanel>
</template>
<script setup>
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
defineProps({ panels: { type: Array, default: () => [] } })
</script>
