<template>
  <section v-if="abilities.length" class="race-abilities" :aria-label="label">
    <div class="sheet-section-title">{{ label }}</div>
    <div class="race-ability-grid">
      <BaseTile v-for="ability in abilities" :key="ability.id" class="race-ability-card">
        <ObjectListItem :item="ability" :type="type" :subtitle="Number(ability.data?.level) > 1 ? `С ${ability.data.level}-го уровня` : 'С 1-го уровня'"
          :name-en="ability.nameEn || ''" interactive @activate="viewItem = ability">
          <template #icon-fallback><Sparkles :size="24" aria-hidden="true" /></template>
        </ObjectListItem>
        <RichContent v-if="showDescriptions" class="race-ability-description" :html="ability.data?.desc || ability.data?.description || ''" />
      </BaseTile>
    </div>
    <ItemViewModal v-if="viewItem" :item="viewItem" :item-id="viewItem.id" :item-type-id="3" @close="viewItem = null" />
  </section>
</template>
<script setup>
import { ref } from 'vue'
import { BaseTile } from '@sylvieshare/share-ui'
import { Sparkles } from '@lucide/vue'
import ObjectListItem from '@/features/items/list-components/ObjectListItem.vue'
import RichContent from '@/shared/ui/DndRichContent.vue'
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
defineProps({ showDescriptions: { type: Boolean, default: false }, label: { type: String, default: 'Способности расы' }, abilities: { type: Array, default: () => [] }, type: { type: Object, default: null } })
const viewItem = ref(null)
</script>
<style scoped>
.race-abilities { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.race-ability-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 8px; }
.race-ability-description { padding: 0 4px 10px; color: var(--text-2); font-size: 13px; line-height: 1.6; }
.race-ability-card { padding: 4px 10px; min-width: 0; }
.race-ability-card :deep(.oli-name) { white-space: normal; }
.race-ability-card :deep(.oli:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-md); }
</style>
