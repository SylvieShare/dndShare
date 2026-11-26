<template>
  <div v-if="cell" class="weapon-alternative-menu">
    <MechanicTheses :lines="cell.requirements" />
    <small v-if="cell.error" role="alert">{{ cell.error }}</small>
    <ActionButton :disabled="cell.disabled" @click="roll">Бросить на урон</ActionButton>
  </div>
</template>
<script setup>
import { computed, inject, watch } from 'vue'
import { ActionButton } from '@sylvieshare/share-ui'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { useWeaponCardPreview } from '../composables/useWeaponCardPreview'
const props = defineProps({ entry: { type: Object, required: true }, selection: { type: Object, required: true } })
const emit = defineEmits(['preview', 'roll-step'])
const ctx = inject('weaponsBlockCtx')
const draft = computed(() => ({ scope: 'damage', damageKey: props.selection.key, options: {} }))
const { alternativeDamage } = useWeaponCardPreview(ctx, () => props.entry, () => draft.value)
const cell = computed(() => alternativeDamage.value.find(row => row.key === props.selection.key))
watch(draft, value => emit('preview', value), { immediate: true })
function roll() {
  if (!cell.value || cell.value.disabled) return
  emit('roll-step', { weaponUseKey: props.selection.useKey, stepKey: props.selection.stepKey })
}
</script>
<style scoped>
.weapon-alternative-menu { display: grid; gap: var(--spacing-label); }
.weapon-alternative-menu > small { color: var(--danger); }
</style>
