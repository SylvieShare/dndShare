<template>
  <DetailSection v-if="item.data?.item_creation?.length" label="Создаваемые предметы">
    <template #icon><PackagePlus /></template>
    <div v-for="option in item.data.item_creation" :key="option.key" class="creation-detail">
      <strong v-if="item.data.item_creation.length > 1">{{ option.title }}</strong>
      <HandbookReferenceRows :rows="(option.outputs || []).map(row => ({ ...row, id: row.item }))">
        <template #leading="{ row }"><strong>×{{ row.count ?? 1 }}</strong></template>
        <template #description="{ row }"><small><template v-if="option.choose_count">Можно создать меньше. </template><template v-if="row.per_slot">+{{ row.per_slot }} за каждые {{ row.scaling_step || 1 }} круга свыше базового. </template>{{ row.duration ? statusDuration(row.duration) : '' }}<template v-if="row.on_expire === 'vanish'"> · затем исчезает</template></small></template>
      </HandbookReferenceRows>
      <p v-if="option.condition">{{ option.condition }}</p>
    </div>
  </DetailSection>
  <DetailSection v-if="item.data?.creation_sources?.length" label="Создаётся магией">
    <template #icon><Sparkles /></template>
    <HandbookReferenceRows :rows="item.data.creation_sources.map(row => ({ id: row.item }))" />
  </DetailSection>
</template>
<script setup>
import { DetailSection } from '@sylvieshare/share-ui'
import { PackagePlus, Sparkles } from '@lucide/vue'
import { statusDuration } from '@/shared/lib/statusDuration'
import HandbookReferenceRows from '../components/HandbookReferenceRows.vue'
defineProps({ item: Object })
</script>
<style scoped>
.creation-detail { display: grid; gap: 12px; }
.creation-detail + .creation-detail { margin-top: 16px; }
.creation-detail small { color: var(--text-muted); }
.creation-detail p { margin: 0; }
</style>
