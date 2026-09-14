<template>
  <MorphTile embedded padding="0" edit-label="Редактировать" :title="label" :show-edit="editable" @edit="$emit('edit', $event)" class="btv" :class="{ 'btv--panel': panel }">

    <div v-if="visibleSections.length" class="btv-sections">
      <div v-for="sec in visibleSections" :key="sec.title" class="btv-sec">
        <span class="btv-sec-title">{{ sec.title }}:</span>
        <span class="btv-sec-tags">{{ sec.tags.join(', ') }}</span>
      </div>
    </div>
    <span v-else class="btv-empty">нет</span>
  </MorphTile>
</template>

<script setup>
import { MorphTile } from '@sylvieshare/share-ui'
import { computed } from 'vue'

const props = defineProps({
  sections: { type: Array, default: () => [] },
  label: { type: String, default: 'Владения' },
  editable: { type: Boolean, default: false },
  panel: { type: Boolean, default: false },
})

const visibleSections = computed(() => props.sections.filter(s => (s.tags || []).length))
defineEmits(['edit'])
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
