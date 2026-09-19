<template>
  <AbilitySelectionPanel v-for="parent in abilitySelectionParents" :key="parent.id" :parent="parent"
    :values="abilitySelectionValues" :original-values="{}" :items="classAbilities"
    :initial-entries="state.abilitySelections?.[parent.id]?.entries || []" @change="setAbilitySelection" />
</template>
<script setup>
import { inject } from 'vue'
import AbilitySelectionPanel from '@/features/character-editor/components/AbilitySelectionPanel.vue'
const { state, classAbilities, abilitySelectionParents, abilitySelectionValues, setAbilitySelection } = inject('createWizard')
</script>
