<template>
  <div v-if="event?.status === 'active'" class="weapon-use-panels" @click.stop @pointerdown.stop>
    <ItemUsePanel v-for="step in event.steps.filter(row => row.kind === 'damage')" :key="`${event.id}:${step.key}`" :title="step.title">
      <WeaponUseStep :step="step" :can-manage="!!charCtx.ownerMode" :busy="busy" @roll="resolve(step.key)" />
    </ItemUsePanel>
    <ActionButton v-if="charCtx.ownerMode" variant="quiet" :disabled="busy" @click="finishOrConfirm">Завершить применение</ActionButton>
    <ConfirmDialog v-if="confirmId" title="Завершить применение?" message="Неиспользованный дополнительный урон и оставшиеся броски будут закрыты. Потраченный ресурс не возвращается." confirm-text="Завершить" @confirm="finish(confirmId); confirmId = null" @cancel="confirmId = null" @close="confirmId = null" />
  </div>
</template>
<script setup>
import { inject, ref, toRef } from 'vue'
import { ActionButton, ConfirmDialog } from '@sylvieshare/share-ui'
import ItemUsePanel from './ItemUsePanel.vue'
import WeaponUseStep from './WeaponUseStep.vue'
import { useWeaponUseSteps } from '../composables/useWeaponUseSteps'
const props = defineProps({ uid: { type: String, required: true } })
const charCtx = inject('charCtx', {})
const { event, busy, resolve, finish } = useWeaponUseSteps(charCtx, toRef(props, 'uid'))
const confirmId = ref(null)
function finishOrConfirm() { if (event.value.steps.some(step => step.status === 'pending')) confirmId.value = event.value.id; else finish(event.value.id) }
</script>
<style scoped>
.weapon-use-panels { display: grid; gap: 8px; }
.weapon-use-panels > :deep(button) { justify-self: start; }
</style>
