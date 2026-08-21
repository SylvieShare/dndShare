<template>
  <SkillPicker
    title="Владение музыкальными инструментами"
    hint="Выбери три конкретных инструмента — каждый требует отдельного владения."
    empty-text="Класс не предлагает выбор владений инструментами."
    :options="classToolProficiencyOptions"
    :selected="state.classToolProficiencyIds"
    :limit="classToolProficiencyLimit"
    :show-mechanics="false"
    @toggle="toggleClassToolProficiency"
  />
</template>

<script setup>
import { inject } from 'vue'
import SkillPicker from '@/features/character-list/components/wizard/SkillPicker.vue'

const {
  state,
  classToolProficiencyOptions,
  classToolProficiencyLimit,
  toggleClassToolProficiency,
} = inject('createWizard')
</script>
