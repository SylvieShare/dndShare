<template>
  <div class="participant-statuses" role="group" aria-label="Эффекты и состояния" @pointerdown.stop @click.stop @contextmenu.stop @keydown.stop>
    <button
      v-for="status in statuses"
      :key="status.uid"
      type="button"
      class="participant-status"
      :aria-label="status.title"
      :style="{ color: status.color }"
      @mouseenter="showTooltip($event, status)"
      @mouseleave="tooltip = null"
      @focus="showTooltip($event, status)"
      @blur="tooltip = null"
      @click.stop="openStatus(status)"
    >
      <ItemIcon v-if="status.item.iconImageUrl || status.item.svg" :item="status.item" :size="24" :fallback-to-type="false" />
      <Sparkles v-else :size="22" aria-hidden="true" />
    </button>
  </div>
  <ItemTooltip v-if="tooltip" :anchor="tooltip.anchor" :title="tooltip.title" :desc="tooltip.description" :width="300" :z-index="9500">
    <template #details>
      <span>{{ statusDuration(tooltip.duration) }}</span>
      <span v-if="tooltip.params?.level">Уровень {{ tooltip.params.level }}</span>
      <span v-if="tooltip.concentration">Концентрация</span>
    </template>
  </ItemTooltip>
  <ItemViewModal v-if="viewItem" :item="viewItem" :item-id="Number(viewItem.id)" :item-type-id="15" :z-index="9600" @close="viewItem = null" />
</template>

<script setup>
import { computed, defineAsyncComponent, shallowRef } from 'vue'
import { Sparkles } from '@lucide/vue'
import ItemIcon from '@/features/items/components/ItemIcon.vue'
import ItemTooltip from '@/features/character-editor/components/ItemTooltip.vue'
import { useItemReferenceMap } from '@/features/items/composables/useItemReferenceMap'
import { collectCharacterStatuses } from '@/features/character-editor/lib/characterStatuses'
import { statusDuration } from '@/shared/lib/statusDuration'

const ItemViewModal = defineAsyncComponent(() => import('@/features/handbook/components/ItemViewModal.vue'))
const props = defineProps({ instances: { type: Array, default: () => [] } })
const itemIds = computed(() => props.instances.map(status => status.effect_id))
const { itemsById } = useItemReferenceMap(itemIds)
const statuses = computed(() => collectCharacterStatuses({ states: props.instances }, itemsById.value))
const tooltip = shallowRef(null)
const viewItem = shallowRef(null)

function showTooltip(event, status) { tooltip.value = { ...status, anchor: event.currentTarget } }
function openStatus(status) {
  tooltip.value = null
  viewItem.value = status.item
}
</script>

<style scoped>
.participant-statuses { display: flex; align-items: center; gap: 4px; height: 28px; min-width: 0; overflow-x: auto; overflow-y: hidden; scrollbar-width: thin; }
.participant-status { display: inline-flex; flex: 0 0 24px; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; border: 0; background: none; cursor: pointer; transition: opacity .15s, transform .15s; }
.participant-status:hover { opacity: .8; transform: translateY(-1px); }
.participant-status:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: var(--r-sm); }
@media (prefers-reduced-motion: reduce) { .participant-status { transition: none; } }
</style>
