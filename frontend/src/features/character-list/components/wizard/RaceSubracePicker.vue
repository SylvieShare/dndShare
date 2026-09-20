<template>
  <section class="subrace-picker" aria-label="Выбор подрасы">
    <div class="sheet-section-title">Происхождение</div>
    <div class="subrace-grid">
      <SubraceSelectCard v-for="option in options" :key="option.id" :title="option.name"
        :subtitle="asiSummary(option)" :description="shortRaceDescription(option)"
        :monogram="monogramOf(option.name)" :image-url="option.coverImageUrl || ''"
        :selected="modelValue?.id === option.id" @select="$emit('update:modelValue', option)" />
    </div>
    <div v-if="modelValue" class="subrace-details" aria-live="polite">
      <h3>{{ modelValue.name }}</h3>
      <RichContent v-if="showFullDescription" :html="modelValue.data.description" />
      <RaceAbilityList :abilities="selectedAbilities" label="Способности подрасы" />
    </div>
  </section>
</template>
<script setup>
import { computed } from 'vue'
import SubraceSelectCard from './SubraceSelectCard.vue'
import { asiSummary, monogramOf } from './labels'
import { shortRaceDescription } from './raceCardSummary'
import RichContent from '@/shared/ui/DndRichContent.vue'
import RaceAbilityList from '@/features/items/components/RaceAbilityList.vue'
import { featuresForBinding } from '@/features/character-editor/settings/dnd/creation/progression'
const props = defineProps({ options: { type: Array, default: () => [] }, modelValue: { type: Object, default: null }, raceId: { type: Number, default: null }, abilities: { type: Array, default: () => [] } })
defineEmits(['update:modelValue'])
const showFullDescription = computed(() => {
  const full = shortRaceDescription({ data: { description: props.modelValue?.data?.description } }, Infinity)
  return full && full !== shortRaceDescription(props.modelValue)
})
const selectedAbilities = computed(() => featuresForBinding(props.abilities, { raceId: props.raceId, subraceId: props.modelValue?.id }, 20)
  .filter(ability => ability.data?.subrace_ids?.length))
</script>
<style scoped>
.subrace-picker, .subrace-details { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.subrace-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.subrace-details { color: var(--text-2); font-size: 13px; line-height: 1.6; }
.subrace-details h3 { margin: 0; color: var(--text-1); font-family: var(--font-display); font-size: 20px; }
@media (max-width: 640px) { .subrace-grid { grid-template-columns: minmax(0, 1fr); } }
</style>
