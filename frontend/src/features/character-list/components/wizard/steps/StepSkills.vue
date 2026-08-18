<template>
  <SkillPicker
    title="Владение навыками"
    :hint="hint"
    :empty-text="emptyText"
    :options="options"
    :selected="selected"
    :limit="limit"
    @toggle="toggle"
  />
</template>

<script setup>
import { computed, inject } from 'vue'
import SkillPicker from '@/features/character-list/components/wizard/SkillPicker.vue'

const props = defineProps({ source: { type: String, default: 'class' } })
const { state, skillOptions, skillLimit, toggleSkill, raceSkillOptions, raceSkillLimit, toggleRaceSkill } = inject('createWizard')
const options = computed(() => props.source === 'race' ? raceSkillOptions.value : skillOptions.value)
const limit = computed(() => props.source === 'race' ? raceSkillLimit.value : skillLimit.value)
const selected = computed(() => props.source === 'race' ? state.raceSkillIds : state.skillIds)
const toggle = (id) => (props.source === 'race' ? toggleRaceSkill(id) : toggleSkill(id))
const hint = computed(() => props.source === 'race'
  ? 'Раса даёт владение выбранными навыками — бонус мастерства прибавляется к профильной характеристике.'
  : 'От класса ты владеешь выбранными навыками — бонус мастерства прибавляется к профильной характеристике.')
const emptyText = computed(() => props.source === 'race'
  ? 'Раса не предлагает выбор навыков.'
  : 'Класс не предлагает выбор навыков.')
</script>
