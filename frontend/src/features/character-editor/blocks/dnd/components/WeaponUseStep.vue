<template>
  <BaseTile class="weapon-use-step">
    <strong>{{ step.title }}</strong>
    <MechanicTheses :lines="requirements" />
    <DamageFormulaPreview v-if="step.status === 'pending'" :expression="critical && step.kind === 'weapon_damage' ? step.critical_expression : step.expression" label="" />
    <template v-if="step.status === 'pending' && canManage">
      <FormField v-if="step.kind === 'weapon_damage'" label="Критическое попадание" title="Удваивает кости урона этого попадания. Урон по области не меняется."><ToggleSwitch v-model="critical" :disabled="busy" :aria-label="`Критическое попадание: ${step.title}`" /></FormField>
      <div class="weapon-use-step-actions"><ActionButton :disabled="busy" @click="$emit('roll', critical)">Бросить урон</ActionButton><ActionButton v-if="step.kind === 'weapon_damage'" variant="quiet" :disabled="busy" @click="$emit('miss')">Промах</ActionButton></div>
    </template>
    <p v-else-if="step.status === 'missed'">Промах — урон по цели не наносится.</p>
    <p v-else-if="step.result" class="weapon-use-result">{{ step.save ? `При провале: ${step.result.total}` : `Урон: ${step.result.total}` }}<span v-if="step.half_result != null"> · При успехе: {{ step.half_result }}</span></p>
    <small v-else>Ожидает решения владельца</small>
  </BaseTile>
</template>
<script setup>
import { weaponUseRequirements } from '@/shared/lib/weaponUsePresentation'
import { computed, ref, watch } from 'vue'
import { ActionButton, BaseTile, FormField, ToggleSwitch } from '@sylvieshare/share-ui'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import DamageFormulaPreview from './DamageFormulaPreview.vue'
const props = defineProps({ step: Object, canManage: Boolean, busy: Boolean, initialCritical: Boolean })
defineEmits(['roll', 'miss'])
const critical = ref(props.initialCritical)
watch(() => props.initialCritical, value => { if (props.step.status === 'pending') critical.value = value })
const requirements = computed(() => weaponUseRequirements(props.step))
</script>
<style scoped>
.weapon-use-step { padding: 10px; display: grid; gap: 8px; min-width: 0; }
.weapon-use-step > strong { font-size: 13px; color: var(--text-1); }
.weapon-use-step :deep(.mechanic-theses) { margin: 0; }
.weapon-use-step-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.weapon-use-step p { margin: 0; font-size: 13px; color: var(--text-2); }
.weapon-use-result { font-weight: 650; }
.weapon-use-step small { color: var(--text-muted); }
</style>
