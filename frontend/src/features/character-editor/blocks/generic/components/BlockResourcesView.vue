<template>
  <!-- Shared resources face, rendered in the tile and in the morph #view so they never drift.
       Padding is owned by this component; pips stay tickable in play. -->
  <MorphTile embedded padding="0" edit-label="Редактировать"
      :title="title"
      :show-edit="manage"
      :edit-fade="editFade"
      @edit="$emit('manage')"
     class="brv" :class="{ 'brv--panel': panel }">

    <div v-if="resources.length" class="brv-list">
      <div v-for="(res, i) in resources" :key="res.key || i" class="brv-row">
        <div class="brv-trow">
          <span class="brv-title" :style="{ color: res.color_point }">{{ res.title }}</span>
          <ResourceRestIcons :resource="res" />
        </div>
        <div class="brv-pips">
          <SpellSlotSphere
            v-for="p in res.total"
            :key="p"
            :spent="p > res.value"
            :size="ORB_SIZE"
            :color="res.color_point || undefined"
            :interactive="canInteract"
            @click="canInteract && $emit('toggle', i, p)"
          />
          <span v-if="!res.total" class="brv-row-empty">—</span>
        </div>
      </div>
    </div>

    <span v-else class="brv-empty">нет</span>
  </MorphTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'
import ResourceRestIcons from '@/features/character-editor/blocks/generic/components/ResourceRestIcons.vue'

const ORB_SIZE = 30   // spell-slot scale, fixed regardless of count

defineProps({
  resources: { type: Array, default: () => [] },
  title: { type: String, default: 'Ресурсы' },
  manage: { type: Boolean, default: false },
  editFade: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
  canInteract: { type: Boolean, default: false },
})

defineEmits(['toggle', 'manage'])
</script>

<style scoped>
.brv {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 9px 10px 10px;
  box-sizing: border-box;
}
.brv--panel { padding-right: 14px; }

.brv-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.brv-row {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.brv-trow {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.brv-title {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  line-height: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.brv-pips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.brv-row-empty {
  color: var(--text-muted);
  font-size: 14px;
}

.brv-empty {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
}
</style>
