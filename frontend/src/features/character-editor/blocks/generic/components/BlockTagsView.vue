<template>
  <div class="btv" :class="{ 'btv--panel': panel }">
    <div class="btv-head">
      <span class="sheet-tile-title btv-label">{{ label }}</span>
      <span v-if="editable" class="btv-pencil" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </span>
    </div>
    <div v-if="visibleSections.length" class="btv-sections">
      <div v-for="sec in visibleSections" :key="sec.title" class="btv-sec">
        <span class="btv-sec-title">{{ sec.title }}:</span>
        <span class="btv-sec-tags">{{ sec.tags.join(', ') }}</span>
      </div>
    </div>
    <span v-else class="btv-empty">нет</span>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  sections: { type: Array, default: () => [] },
  label: { type: String, default: 'Владения' },
  editable: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
})

const visibleSections = computed(() => props.sections.filter(s => (s.tags || []).length))
</script>

<style scoped>
.btv {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 9px;
  min-height: 42px;
  padding: 10px 12px 10px 14px;
  box-sizing: border-box;
  min-width: 0;
}

.btv--panel {
  padding-right: 16px;
}

.btv-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btv-label {
  flex-shrink: 0;
}

.btv-pencil {
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.35;
  transition: opacity 0.15s;
}
@media (hover: hover) { .btv:hover .btv-pencil { opacity: 1; } }

.btv-sections {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.btv-sec {
  min-width: 0;
  font-size: 13px;
  line-height: 1.45;
}

.btv-sec-title {
  color: var(--text-1);
  font-weight: 650;
  margin-right: 3px;
}

.btv-sec-tags {
  color: var(--text-muted);
}

.btv-empty {
  margin-top: 1px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-2);
}
</style>
