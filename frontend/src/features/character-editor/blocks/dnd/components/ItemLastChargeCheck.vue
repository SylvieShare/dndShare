<template>
  <ItemUsePanel v-if="visible" :title="lost ? 'Магические свойства утрачены' : 'Проверка последнего заряда'"
    :subtitle="lost ? `Выпало ${check.result}. Действуют только свойства основы.` : `На ${Number(check.rule.failure_max) === 1 ? '1' : `1–${check.rule.failure_max}`} предмет становится немагическим.`">
    <template #icon><SystemDie :sides="Number(check.rule.dice.slice(1))" :value="check.result ?? undefined" :size="32" :animated="false" /></template>
    <template v-if="charCtx.ownerMode" #actions>
      <ActionButton v-if="check.status === 'pending'" :loading="busy" @click="roll">Проверить</ActionButton>
      <ActionButton variant="quiet" @click="confirmId = check.id">{{ lost ? 'Отменить утрату магии' : 'Отменить проверку' }}</ActionButton>
    </template>
    <small v-if="!charCtx.ownerMode && check.status === 'pending'">Ожидает броска владельца персонажа</small>
    <ConfirmDialog v-if="confirmId" title="Отменить проверку?" message="Отменится только проверка и её последствие. Израсходованные заряды не возвращаются. Используйте это для исправления ошибочного расхода или применения." confirm-text="Отменить проверку" @confirm="undo(confirmId); confirmId = null" @close="confirmId = null" @cancel="confirmId = null" />
  </ItemUsePanel>
</template>
<script setup>
import { computed, inject, ref, toRef } from 'vue'
import { ActionButton, ConfirmDialog } from '@sylvieshare/share-ui'
import ItemUsePanel from './ItemUsePanel.vue'
import SystemDie from '@/shared/ui/SystemDie.vue'
import { useLastChargeCheck } from '../composables/useLastChargeCheck'
const props = defineProps({ uid: { type: String, required: true } })
const charCtx = inject('charCtx', {})
const { entry, check, busy, roll, undo } = useLastChargeCheck(charCtx, toRef(props, 'uid'))
const lost = computed(() => !!entry.value?.params?.magic?.lost)
const visible = computed(() => check.value && (check.value.status === 'pending' || lost.value))
const confirmId = ref(null)
</script>
