<template>
  <div v-if="cell" class="weapon-alternative-menu" :class="{ 'weapon-alternative-menu--dialog': dialog }">
    <strong v-if="!dialog">{{ ctx.itemTitle(entry) }} · {{ cell.title }}</strong>
    <MechanicTheses :lines="cell.requirements" />
    <small v-if="cell.error" role="alert">{{ cell.error }}</small>
    <ActionButton v-if="dialog" :disabled="cell.disabled" @click="roll">Бросить на урон</ActionButton>
    <RowActionItem v-else action="damage" :disabled="cell.disabled" @click="roll">Бросить на урон</RowActionItem>
  </div>
</template>
<script setup>
import { computed, inject, watch } from 'vue'
import RowActionItem from '@/shared/ui/RowActionItem.vue'
import { ActionButton } from '@sylvieshare/share-ui'
import MechanicTheses from '@/shared/ui/MechanicTheses.vue'
import { useWeaponCardPreview } from '../composables/useWeaponCardPreview'
const props = defineProps({ dialog: Boolean, entry: { type: Object, required: true }, selection: { type: Object, required: true } })
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
.weapon-alternative-menu { display: grid; gap: var(--spacing-label); width: var(--layout-roll-mode-menu-width); max-width: min(100%,calc(100vw - 32px)); padding: var(--spacing-small); box-sizing: border-box; }
.weapon-alternative-menu > strong { color: var(--text-1); font-size: var(--type-group-size); }
.weapon-alternative-menu > small { color: var(--danger); }
.weapon-alternative-menu--dialog {width:100%;max-width:none;padding:0}
</style>
