<template>
  <ItemUsePanel v-if="source && (source.active || source.state)" :title="source.rule.title" :subtitle="subtitle">
    <template #icon><Crosshair :size="24" /></template>
    <p v-if="source.state?.status === 'active'" class="target-facts">
      <span v-if="source.rule.other_weapons_disadvantage && source.penaltyActive">Другим оружием — с помехой</span>
      <span v-if="!source.active">Свойства для этой цели сейчас неактивны</span>
      <span>Осталось рассветов: {{ source.state.dawns_left }}</span>
    </p>
    <form v-if="charCtx.ownerMode && source.active && source.available" class="target-declare" @submit.prevent="declare">
      <FormField label="Имя противника" :title="source.rule.condition || 'Объявите цель при атаке этим оружием.'" vertical>
        <FormTextInput v-model:value="name" :maxlength="120" placeholder="Например, предводитель орков" aria-label="Имя противника" />
      </FormField>
      <ActionButton type="submit" :disabled="!name.trim()">Объявить цель</ActionButton>
    </form>
    <template v-if="charCtx.ownerMode && source.state" #actions>
      <ActionButton v-if="source.state.status === 'active'" variant="quiet" @click="confirm = { operation: 'defeat', id: source.state.id }">Враг погиб</ActionButton>
      <ActionButton variant="quiet" title="Только для исправления ошибочно объявленной цели" @click="confirm = { operation: 'correct', id: source.state.id }">Исправить выбор</ActionButton>
    </template>
    <ConfirmDialog v-if="confirm" :title="confirm.operation === 'defeat' ? 'Враг погиб?' : 'Сбросить ошибочный выбор?'"
      :message="confirm.operation === 'defeat' ? `Эффекты цели прекратятся. Ожидание новой цели: ${source.rule.cooldown_dawns} рассветов.` : 'Это исправление ошибки снимет эффекты и ожидание. Для обычного завершения используйте «Враг погиб» или дождитесь истечения срока.'"
      confirm-text="Подтвердить" @confirm="change(confirm.operation, { id: confirm.id }); confirm = null" @close="confirm = null" @cancel="confirm = null" />
  </ItemUsePanel>
</template>
<script setup>
import { computed, inject, ref, toRef } from 'vue'
import { ActionButton, ConfirmDialog, FormField, FormTextInput } from '@sylvieshare/share-ui'
import { Crosshair } from '@lucide/vue'
import ItemUsePanel from './ItemUsePanel.vue'
import { useSelectedTarget } from '../composables/useSelectedTarget'
const props = defineProps({ uid: { type: String, required: true } })
const charCtx = inject('charCtx', {})
const { source, change } = useSelectedTarget(charCtx, toRef(props, 'uid'))
const name = ref(''), confirm = ref(null)
const subtitle = computed(() => {
  const state = source.value?.state
  if (!state) return source.value?.rule.condition || 'Объявите цель при атаке этим оружием.'
  if (state.status === 'active') return state.name
  if (state.status === 'defeated') return `${state.name} погиб. До новой цели осталось рассветов: ${state.dawns_left}.`
  return `${state.name}: ${state.status === 'expired' ? 'срок истёк' : 'ожидание завершено'}. Можно объявить новую цель.`
})
function declare() { if (change('declare', name.value)) name.value = '' }
</script>
<style scoped>
.target-declare { display: grid; gap: 8px; }
.target-declare > button { justify-self: start; }
.target-facts { display: flex; flex-wrap: wrap; gap: 6px 14px; margin: 0; color: var(--text-2); font-size: 12px; }
</style>
