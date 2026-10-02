<template>
  <AppModalFrame title="Дать денег" width="440px" :z-index="3600" close-label="Закрыть" :dismissible="!controller.busy" @close="controller.close">
    <div class="money-transfer" :aria-busy="controller.busy">
      <TransferPerson :name="state.peer.name" :image-url="state.peer.imageUrl" :size="48" />
      <LoadingIndicator v-if="state.loading" label="Загрузка валют" />
      <template v-else>
        <FormField label="Валюта" vertical>
          <FormSelect v-model:value="state.currencyId" aria-label="Валюта" :disabled="controller.busy || !controller.coins.length">
            <option v-for="coin in controller.coins" :key="coin.id" :value="String(coin.id)">{{ coin.value }}</option>
          </FormSelect>
        </FormField>
        <FormField label="Сумма" vertical>
          <FormTextInput v-model:value="state.amount" type="number" inputmode="numeric" aria-label="Сумма" :min="1" :max="Number.MAX_SAFE_INTEGER" :step="1" :disabled="controller.busy || !controller.coins.length" />
        </FormField>
        <p class="money-transfer-hint">В кошельке: {{ controller.balance }}. Деньги сразу поступят получателю.</p>
        <p v-if="!controller.coins.length" class="money-transfer-hint">Валют пока нет.</p>
        <p v-else-if="Number(state.amount) > controller.balance" class="money-transfer-hint">Недостаточно денег для нового перевода.</p>
      </template>
      <p v-if="state.error" role="alert" class="money-transfer-error">{{ state.error }}</p>
      <ActionButton v-if="state.error && !controller.coins.length" variant="quiet" :disabled="controller.busy || state.loading" @click="controller.open(state.peer)">Повторить загрузку</ActionButton>
    </div>
    <template #footer>
      <FormActionButtons submit-text="Дать денег" loading-text="Передача…" :loading="controller.busy" :disabled="controller.busy" :can-submit="controller.canSubmit" @cancel="controller.close" @submit="controller.send" />
    </template>
  </AppModalFrame>
</template>
<script setup>
import { computed } from 'vue'
import { ActionButton, AppModalFrame, FormActionButtons, FormField, FormTextInput, FormSelect, LoadingIndicator } from '@sylvieshare/share-ui'
import TransferPerson from '@/features/item-transfers/components/TransferPerson.vue'
const props = defineProps({ controller: { type: Object, required: true } })
const state = computed(() => props.controller.state)
</script>
<style scoped>
.money-transfer { display: grid; gap: 16px; }
.money-transfer p { margin: 0; }
.money-transfer-hint { color: var(--text-muted); font-size: 13px; line-height: 1.5; }
.money-transfer-error { color: var(--danger); }
</style>
