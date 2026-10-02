<template>
  <ItemMechanicPanel v-for="note in notes" :key="note.key" :kind="note.kind" :title="note.title">
    <DndRichContent :html="note.description" :item="item" />
    <MechanicTheses :lines="note.requirements || []" :color="itemMechanicKinds[note.kind]?.color" />
  </ItemMechanicPanel>
</template>
<script setup>
import ItemMechanicPanel from './ItemMechanicPanel.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { itemMechanicKinds } from '@/features/items/lib/itemMechanicPresentation'
defineProps({ notes: { type: Array, default: () => [] }, item: Object })
</script>
