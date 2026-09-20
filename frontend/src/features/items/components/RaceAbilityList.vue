<template>
  <section v-if="abilities.length" class="race-abilities" aria-label="Способности расы">
    <div class="sheet-section-title">Способности</div>
    <div class="race-ability-grid">
      <BaseTile v-for="ability in abilities" :key="ability.id" class="race-ability-card">
        <ObjectListItem :item="ability" :type="type" :subtitle="Number(ability.data?.level) > 1 ? `С ${ability.data.level}-го уровня` : 'С 1-го уровня'"
          :name-en="ability.nameEn || ''" interactive @activate="viewItem = ability">
          <template #icon-fallback><Sparkles :size="24" aria-hidden="true" /></template>
        </ObjectListItem>
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
import ItemViewModal from '@/features/handbook/components/ItemViewModal.vue'
defineProps({ abilities: { type: Array, default: () => [] }, type: { type: Object, default: null } })
const viewItem = ref(null)
</script>
<style scoped>
.race-abilities { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.race-ability-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); gap: 8px; }
.race-ability-card { padding: 4px 10px; min-width: 0; }
.race-ability-card :deep(.oli-name) { white-space: normal; }
.race-ability-card :deep(.oli:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: var(--r-md); }
</style>
