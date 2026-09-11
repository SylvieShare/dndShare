<template>
  <div class="weapon-use-step">
    <MechanicTheses :lines="requirements" />
    <div class="weapon-use-roll">
      <ActionButton v-if="step.status === 'pending' && canManage" :disabled="busy" @click="$emit('roll')">Бросить урон</ActionButton>
      <DamageFormulaPreview v-if="step.status === 'pending'" :expression="step.expression" label="" unframed />
      <DiceRollResult v-else-if="step.result" :result="step.result" />
    </div>
    <small v-if="step.status === 'pending' && !canManage">Ожидает броска владельца</small>
  </div>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import { weaponUseRequirements } from '@/shared/lib/weaponUsePresentation'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
const props = defineProps({ step: Object, canManage: Boolean, busy: Boolean })
defineEmits(['roll'])
const requirements = computed(() => weaponUseRequirements(props.step))
</script>
<style scoped>
.weapon-use-step { display: grid; gap: 8px; min-width: 0; }
.weapon-use-step :deep(.mechanic-theses) { margin: 0; }
.weapon-use-roll { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.weapon-use-step small { color: var(--text-muted); }
</style>
