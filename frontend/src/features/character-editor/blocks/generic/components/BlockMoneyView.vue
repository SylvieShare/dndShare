<template>
  <MorphTile :embedded="panel || inline" padding="0" edit-label="Редактировать" :title="inline ? '' : title"
    :show-edit="editable && !inline" @edit="$emit('edit', $event)" class="money-view"
    :class="{ 'money-view--inline': inline, 'money-view--panel': panel, 'money-view--morph-preview': morphPreview }"
    :role="morphPreview ? 'group' : undefined" :aria-label="morphPreview ? 'Кошелёк' : undefined"
    :aria-description="morphPreview ? balanceDescription : undefined">
    <component :is="buttonLayout ? ActionButton : 'div'" class="money-content"
      :variant="buttonLayout ? 'quiet' : undefined" :disabled="morphPreview || undefined"
      :style="morphPreview ? { opacity: 1 } : undefined"
      :aria-hidden="morphPreview || undefined"
      :aria-label="canEditWallet ? 'Изменить кошелёк' : undefined"
      :aria-description="canEditWallet ? balanceDescription : undefined"
      :title="canEditWallet ? 'Изменить кошелёк' : undefined" @click="onWalletClick">
      <template v-if="buttonLayout" #icon><Wallet class="money-wallet-icon" :size="22" aria-hidden="true" /></template>
      <Wallet v-if="inline && !buttonLayout" class="money-wallet-icon" :size="22" role="img" :aria-hidden="false" aria-label="Кошелёк" />
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
  morphPreview: Boolean,
  editable: { type: Boolean, default: false },
  title: { type: String, default: '' },
  loading: { type: Boolean, default: false },
  coins: { type: Array, default: () => [] },
})
const emit = defineEmits(['edit'])
const { rows, changes } = useMoneyFeedback(() => props.coins, () => props.loading)
const canEditWallet = computed(() => props.inline && props.editable && !props.panel)
const buttonLayout = computed(() => canEditWallet.value || props.morphPreview)
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
.money-view--morph-preview.money-view--inline { padding: 0; }
.money-view--morph-preview .money-content { pointer-events: none; }
.money-view--inline .money-content { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; max-width: 100%; }
.money-view--inline :deep(.money-line) { justify-content: flex-end; min-width: 0; }
.money-wallet-icon { flex-shrink: 0; color: var(--text-muted); }
</style>
