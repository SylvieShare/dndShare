<template>
  <MorphTile embedded padding="0" edit-label="Редактировать" :title="activeItems.length ? label : emptyLabel" :show-edit="editable" @edit="$emit('edit', $event)" class="bss-view" :class="{ 'bss-view--panel': panel }">

    <div v-if="activeItems.length" class="bss-list">
      <span
        v-for="item in activeItems"
        :key="item.id"
        class="bss-chip"
        :style="{ '--c': item.color || 'var(--text-muted)' }"
        @mouseenter="$emit('show-tooltip', $event, item)"
        @mouseleave="$emit('hide-tooltip')"
      >
        <SvgIcon v-if="item.svg" class="bss-icon" :svg="item.svg" :color="item.color || '#888888'" filter />
        <span v-else class="bss-dot"></span>
        <span class="bss-name">{{ item.value }}</span>
      </span>
    </div>
  </MorphTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import SvgIcon from '@/shared/ui/SvgIcon'

defineProps({
  activeItems: { type: Array, default: () => [] },
  label: { type: String, default: 'Статусы' },
  emptyLabel: { type: String, default: 'Статусов нет' },
  editable: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
})

defineEmits(['edit', 'show-tooltip', 'hide-tooltip'])
</script>

<style scoped>
.bss-view {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-height: 42px;
  padding: 10px 12px 10px 14px;
  box-sizing: border-box;
  min-width: 0;
}

/* panel (morph view): keep the same min-height as the tile so the centred content doesn't jump */
.bss-view--panel {
  padding-right: 16px;
}


.bss-list {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  min-width: 0;
}

.bss-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  max-width: 180px;
  color: var(--c);
}

.bss-icon {
  width: 17px;
  height: 17px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.bss-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  flex-shrink: 0;
}

.bss-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 650;
  color: var(--text-1);
}

</style>
