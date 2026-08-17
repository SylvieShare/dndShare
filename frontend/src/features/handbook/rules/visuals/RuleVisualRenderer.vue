<template>
  <component :is="visualComponent" v-if="visualComponent" />
</template>

<script setup>
import { computed } from 'vue'
import AttackFlowVisual from '@/features/handbook/rules/visuals/AttackFlowVisual'
import CharacterSheetVisual from '@/features/handbook/rules/visuals/CharacterSheetVisual'
import CombatActionsVisual from '@/features/handbook/rules/visuals/CombatActionsVisual'
import CombatTurnVisual from '@/features/handbook/rules/visuals/CombatTurnVisual'
import ConditionsVisual from '@/features/handbook/rules/visuals/ConditionsVisual'
import D20CheckVisual from '@/features/handbook/rules/visuals/D20CheckVisual'
import GameLoopVisual from '@/features/handbook/rules/visuals/GameLoopVisual'
import HealthFlowVisual from '@/features/handbook/rules/visuals/HealthFlowVisual'
import SpellcastingVisual from '@/features/handbook/rules/visuals/SpellcastingVisual'

const props = defineProps({ name: { type: String, required: true } })

const visuals = {
  'game-loop': GameLoopVisual,
  'character-sheet': CharacterSheetVisual,
  'd20-check': D20CheckVisual,
  'combat-turn': CombatTurnVisual,
  'combat-actions': CombatActionsVisual,
  'attack-flow': AttackFlowVisual,
  'health-flow': HealthFlowVisual,
  spellcasting: SpellcastingVisual,
  conditions: ConditionsVisual,
}

const visualComponent = computed(() => visuals[props.name] || null)
</script>
