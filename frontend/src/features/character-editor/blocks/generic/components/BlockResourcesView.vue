<template>
  <!-- Shared resources face, rendered in the tile and in the morph #view so they never drift.
       Padding is owned by this component; pips stay tickable in play. -->
  <div class="brv" :class="{ 'brv--panel': panel }">
    <SheetBlockTitle
      :title="title"
      :show-edit="manage"
      :edit-fade="editFade"
      @edit="$emit('manage')"
    />

    <div v-if="resources.length" class="brv-list">
      <div v-for="(res, i) in resources" :key="res.key || i" class="brv-row">
        <div class="brv-trow">
          <span class="brv-title" :style="{ color: res.color_point }">{{ res.title }}</span>
          <span
            v-if="res.short_rest || res.short_rest_recovery"
            class="brv-rest"
            :title="res.short_rest ? 'Восстанавливается на коротком отдыхе' : `Восстанавливает ${res.short_rest_recovery} на коротком отдыхе`"
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1" /><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
              <line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" />
            </svg>
          </span>
          <span v-if="res.long_rest" class="brv-rest" title="Восстанавливается на длинном отдыхе">
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          </span>
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
  </div>
</template>

<script setup>
import SheetBlockTitle from '@/shared/ui/SheetBlockTitle'
import SpellSlotSphere from '@/features/items/components/SpellSlotSphere.vue'

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

.brv-rest {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  color: var(--text-muted);
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
