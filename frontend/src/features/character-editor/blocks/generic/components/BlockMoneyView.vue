<template>
  <MorphTile :embedded="panel || inline" padding="0" edit-label="Редактировать" :title="inline ? '' : title"
    :show-edit="editable && !inline" @edit="$emit('edit', $event)" class="money-view"
    :class="{ 'money-view--inline': inline, 'money-view--panel': panel }">
    <component :is="canEditWallet ? ActionButton : 'div'" class="money-content"
      :variant="canEditWallet ? 'quiet' : undefined"
      :aria-label="canEditWallet ? 'Изменить кошелёк' : undefined"
      :aria-description="canEditWallet ? balanceDescription : undefined"
      :title="canEditWallet ? 'Изменить кошелёк' : undefined" @click="onWalletClick">
      <template v-if="canEditWallet" #icon><Wallet class="money-wallet-icon" :size="22" aria-hidden="true" /></template>
      <Wallet v-if="inline && !canEditWallet" class="money-wallet-icon" :size="22" role="img" :aria-hidden="false" aria-label="Кошелёк" />
      <MoneyBalanceLine :loading="loading" :rows="rows" :changes="changes" />
    </component>
  </MorphTile>
</template>

<script setup>
import { computed } from 'vue'
import { ActionButton, MorphTile } from '@sylvieshare/share-ui'
import { Wallet } from '@lucide/vue'
import MoneyBalanceLine from './MoneyBalanceLine.vue'
import { useMoneyFeedback } from '@/features/character-editor/composables/useMoneyFeedback'
const props = defineProps({
  panel: Boolean,
  inline: Boolean,
  editable: { type: Boolean, default: false },
  title: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  coins: { type: Array, default: () => [] },
})
const emit = defineEmits(['edit'])
const { rows, changes } = useMoneyFeedback(() => props.coins, () => props.loading)
const canEditWallet = computed(() => props.inline && props.editable && !props.panel)
const formatter = new Intl.NumberFormat('ru-RU')
const balanceDescription = computed(() => rows.value.length
  ? rows.value.map(coin => `${formatter.format(coin.amount)} ${coin.title}`).join(', ')
  : 'Денег нет')
function onWalletClick(event) {
  if (!canEditWallet.value) return
  event.stopPropagation()
  emit('edit', event)
}
</script>

<style scoped>
.money-view { min-width: 0; padding: 12px 14px; }
.money-view--inline:not(.money-view--panel) { padding: 0; }
.money-view--inline.money-view--panel { padding: 16px 18px; }
.money-view--inline .money-content { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; max-width: 100%; }
.money-view--inline :deep(.money-line) { justify-content: flex-end; min-width: 0; }
.money-wallet-icon { flex-shrink: 0; color: var(--text-muted); }
</style>
