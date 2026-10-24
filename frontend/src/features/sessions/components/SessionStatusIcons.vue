<template>
  <div class="participant-statuses" role="group" aria-label="Эффекты и состояния" @pointerdown.stop @click.stop @contextmenu.stop @keydown.stop>
    <DndStatusOverviewView
      :items="items" :editable="context.ownerMode" :context="context" icons-only :icon-size="32"
      @view="viewItem = $event.item"
      @remove="$emit('remove', $event)"
      @increase-level="$emit('change-level', $event, 1)"
      @decrease-level="$emit('change-level', $event, -1)"
      @edit-duration="$emit('edit-duration', $event)"
      @show-tooltip="showTooltip"
      @hide-tooltip="tooltip = null"
    />
  </div>
  <ItemTooltip v-if="tooltip" :anchor="tooltip.anchor" :title="tooltip.value" :desc="tooltip.desc" :width="300" :z-index="9500">
    <template #details>
      <span>{{ tooltip.duration }}</span>
      <span v-if="tooltip.level">Уровень {{ tooltip.level }}</span>
    </template>
  </ItemTooltip>
  <ItemViewModal v-if="viewItem" :item="viewItem" :item-id="Number(viewItem.id)" :item-type-id="15" :z-index="9600" @close="viewItem = null" />
</template>
<script setup>
import { defineAsyncComponent, shallowRef } from 'vue'
import DndStatusOverviewView from '@/features/character-editor/blocks/dnd/components/DndStatusOverviewView.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
const ItemViewModal = defineAsyncComponent(() => import('@/features/handbook/components/ItemViewModal.vue'))
defineProps({ items: { type: Array, default: () => [] }, context: { type: Object, default: () => ({}) } })
defineEmits(['remove', 'change-level', 'edit-duration'])
const tooltip = shallowRef(null), viewItem = shallowRef(null)
function showTooltip(event, item) { tooltip.value = { ...item, anchor: event.currentTarget } }
</script>
<style scoped>
.participant-statuses { min-width: 0; height: 36px; }
</style>
