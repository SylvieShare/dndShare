<template>
  <ItemUsePanel v-if="event?.status === 'active'" :title="event.title" :subtitle="`Бросок атаки: ${event.attack_result?.total ?? '—'}${event.resource_cost ? ` · Уже списано: ${event.resource_cost}` : ''}`">
    <WeaponUseStep v-for="step in event.steps" :key="`${event.id}:${step.key}`" :step="step" :can-manage="!!charCtx.ownerMode" :busy="busy" :initial-critical="!!event.critical"
      @roll="critical => resolve(step.key, critical)" @miss="resolve(step.key, false, true)" />
    <template v-if="charCtx.ownerMode" #actions><ActionButton variant="quiet" :disabled="busy" @click="finishOrConfirm">Завершить применение</ActionButton></template>
    <ConfirmDialog v-if="confirmId" title="Завершить применение?" message="Оставшиеся шаги будут закрыты. Потраченный ресурс не возвращается." confirm-text="Завершить" @confirm="finish(confirmId); confirmId = null" @cancel="confirmId = null" @close="confirmId = null" />
  </ItemUsePanel>
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
