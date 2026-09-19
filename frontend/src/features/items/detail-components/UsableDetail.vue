<template>
  <DetailSection v-if="usable" label="При применении">
    <template #icon><Hand /></template>
    <div class="usable-detail">
      <span class="usable-cost">Расходуется один предмет</span>
      <DamageFormulaPreview v-if="usable.healing" label="Восстановление хитов" default-color="var(--success)" :expression="usable.healing" />
      <DamageFormulaPreview v-if="usable.temporary_hp" label="Временные хиты" default-color="var(--info)" :expression="usable.temporary_hp" />
      <HandbookReferenceRows v-if="usable.spell?.id" :rows="[{ id: usable.spell.id }]" />
      <div v-if="usable.duration" class="usable-duration">
        <Clock :size="16" /><DamageFormulaPreview v-if="usable.duration.formula" :expression="usable.duration.formula" />
        <span>{{ usable.duration.formula ? durationUnit : statusDuration(usable.duration) }}</span>
        <span v-if="usable.concentration"> · Концентрация</span>
      </div>
      <ItemEffectLinks v-if="usable.status_effects?.length" :item="effectItem(usable)" target-label="На выбранную цель" />
      <div v-for="choice in usable.choices || []" :key="choice.key" class="usable-option">
        <strong>{{ choice.name }}</strong>
        <ItemEffectLinks :item="effectItem(choice)" target-label="На выбранную цель" />
      </div>
      <p v-if="usable.note">{{ usable.note }}</p>
    </div>
  </DetailSection>
</template>
<script setup>
import { computed } from 'vue'
import { Clock, Hand } from '@lucide/vue'
import { DetailSection } from '@sylvieshare/share-ui'
import { statusDuration } from '@/shared/lib/statusDuration'
import DamageFormulaPreview from '@/features/character-editor/blocks/dnd/components/DamageFormulaPreview.vue'
import HandbookReferenceRows from '../components/HandbookReferenceRows.vue'
import ItemEffectLinks from '../components/ItemEffectLinks.vue'
const props = defineProps({ item: { type: Object, required: true } })
const usable = computed(() => props.item.data?.usable)
const durationUnit = computed(() => ({ rounds: 'раундов', minutes: 'минут', hours: 'часов' })[usable.value?.duration?.kind] || '')
const effectItem = rule => ({ data: { status_effects: rule.status_effects } })
</script>
<style scoped>
.usable-detail { display: grid; gap: 12px; }
.usable-detail p { margin: 0; }
.usable-cost { color: var(--text-muted); font-size: 12px; }
.usable-duration { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.usable-option { display: grid; gap: 8px; }
</style>
