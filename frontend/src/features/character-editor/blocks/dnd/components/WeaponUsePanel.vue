<template>
  <div v-if="event?.status === 'active'" class="weapon-use-panels" @click.stop @pointerdown.stop>
    <ItemMechanicPanel kind="weapon_use" :key="event.id" :title="event.title">
      <div v-for="step in event.steps.filter(row => row.kind === 'damage')" :key="step.key" class="weapon-use-stage">
        <strong>{{ step.title }}</strong><WeaponUseStep :step="step" :can-manage="!!charCtx.ownerMode" :busy="busy" @roll="resolve(step.key)" />
      </div>
      <template v-if="charCtx.ownerMode" #actions><ActionButton variant="quiet" :disabled="busy" @click="finishOrConfirm">Завершить применение</ActionButton></template>
      <ConfirmDialog v-if="confirmId" title="Завершить применение?" message="Неиспользованный дополнительный урон и оставшиеся броски будут закрыты. Потраченный ресурс не возвращается." confirm-text="Завершить" @confirm="finish(confirmId); confirmId = null" @cancel="confirmId = null" @close="confirmId = null" />
    </ItemMechanicPanel>
  </div>
</template>
<script setup>
import { inject, ref, toRef } from 'vue'
import { ActionButton, ConfirmDialog } from '@sylvieshare/share-ui'
import ItemMechanicPanel from '@/features/items/components/ItemMechanicPanel.vue'
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
.weapon-use-stage { display: grid; gap: 8px; }
.weapon-use-stage > strong { color: var(--text-1); font-size: 13px; }
</style>
