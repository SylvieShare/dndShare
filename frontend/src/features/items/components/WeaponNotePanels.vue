<template>
  <ItemMechanicPanel v-for="note in notes" :key="note.key" :kind="note.kind" :title="note.title">
    <template v-if="resources[note.key]?.length" #summary><WeaponLinkedCharges :resources="resources[note.key]" :interactive="interactive" @toggle="(resource, pip) => $emit('toggle', resource, pip)" /></template>
    <DndRichContent :html="note.description" :item="item" />
    <MechanicTheses :lines="note.requirements || []" :color="itemMechanicKinds[note.kind]?.color" />
  </ItemMechanicPanel>
</template>
<script setup>
import ItemMechanicPanel from './ItemMechanicPanel.vue'
import DndRichContent from '@/shared/ui/DndRichContent.vue'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { itemMechanicKinds } from '@/features/items/lib/itemMechanicPresentation'
import WeaponLinkedCharges from '@/features/character-editor/blocks/dnd/components/WeaponLinkedCharges.vue'
defineProps({ notes: { type: Array, default: () => [] }, item: Object, resources: { type: Object, default: () => ({}) }, interactive: Boolean })
defineEmits(['toggle'])
</script>
