<template>
  <BlockMoneyView v-bind="$attrs" class="money-tile"
    :inline="inline" :title="blockTitle" :loading="loading" :coins="displayCoins"
    :interactive="canInteract" :editable="canInteract"
    @click="openEditor" @edit="openEditor"
  />

  <AppModalFrame v-if="editorOpen" :title="blockTitle || 'Кошелёк'" compact :width="layoutTokens['money-calculator-width']"
    :z-index="3100" close-label="Закрыть калькулятор" @close="closeEditor">
      <div class="mc-ed" :class="{ 'mc-error': calcError }">
        <BlockMoneyView panel :loading="loading" :coins="displayCoins" />
        <CalcPad v-model="calcExpr">
          <template #display-trailing>
            <MoneyCurrencyPicker v-model="calcCoinId" :coins="coins" />
          </template>
        </CalcPad>
        <div class="mc-actions">
          <button class="mc-btn mc-minus" type="button" @click="applyCalc(-1)">Дать</button>
          <button class="mc-btn mc-plus" type="button" @click="applyCalc(1)">Взять</button>
        </div>
      </div>
  </AppModalFrame>

</template>

<script setup>
defineOptions({ inheritAttrs: false })
import { computed, inject, ref, watch } from 'vue'
import BlockMoneyView from '@/features/character-editor/blocks/generic/components/BlockMoneyView'
import CalcPad from '@/features/character-editor/components/CalcPad'
import { AppModalFrame } from '@sylvieshare/share-ui'
import { layoutTokens } from '@/app/design-tokens'
import { useSuggestStore } from '@/stores/suggest'
import MoneyCurrencyPicker from './components/MoneyCurrencyPicker.vue'

const props = defineProps({ block: Object, value: { default: null }, inline: Boolean })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const editorOpen = ref(false)

const loading = ref(false)
const calcExpr = ref('')
const calcCoinId = ref('')
const calcError = ref(false)

const blockTitle = computed(() => props.block.props?.title || props.block.content?.title || '')
const suggestTypeId = computed(() => props.block.content?.suggest_type_id)
const items = computed(() => suggestTypeId.value ? useSuggestStore().items(suggestTypeId.value) || []
  : (props.block.preset || []).filter(coin => coin.id != null).map(coin => ({ ...coin, value: coin.title })))

const coins = computed(() => {
  const normalized = items.value.map(item => normalizeCoin(item))
  const byId = new Map(normalized.map(coin => [String(coin.id), coin]))
  const result = []
  for (const id of order.value) {
    const coin = byId.get(String(id))
    if (!coin) continue
    result.push(coin)
    byId.delete(String(id))
  }
  return [
    ...result,
    ...[...byId.values()].sort((a, b) => a.defaultOrder - b.defaultOrder || a.title.localeCompare(b.title, 'ru')),
  ]
})

const stored = computed(() => {
  return props.value?.amounts && typeof props.value.amounts === 'object'
    ? props.value.amounts
    : {}
})

const order = computed(() => {
  return Array.isArray(props.value?.order) ? props.value.order : []
})

const payload = computed(() => ({
  amounts: { ...stored.value },
  order: coins.value.map(coin => coin.id),
}))

const nonZero = computed(() => coins.value.filter(coin => amount(coin.id) > 0))

// The wallet and dialog share the resolved balances and feedback.
const displayCoins = computed(() => [...nonZero.value].reverse().map(coin => ({
  id: coin.id,
  title: coin.title,
  iconImageUrl: coin.iconImageUrl,
  svg: coin.svg,
  color: coin.color,
  amount: amount(coin.id),
})))

const canInteract = computed(() => charCtx.ownerMode)
watch(canInteract, allowed => { if (!allowed) closeEditor() })

watch(suggestTypeId, () => { loadCoins() }, { immediate: true })
watch(coins, (list) => {
  if (!calcCoinId.value && list.length) calcCoinId.value = String(list[0].id)
}, { immediate: true })

function closeEditor() {
  calcExpr.value = ''
  calcError.value = false
  editorOpen.value = false
}
function openEditor() { if (canInteract.value) editorOpen.value = true }

async function loadCoins() {
  if (!suggestTypeId.value) return
  loading.value = true
  try {
    await useSuggestStore().ensure(suggestTypeId.value)
  } finally {
    loading.value = false
  }
}

function normalizeCoin(item) {
  return {
    id: item.id,
    title: item.value || '',
    shortTitle: item.value || '',
    color: item.color || 'var(--text-muted)',
    iconImageUrl: item.iconImageUrl || '',
    svg: item.svg || '',
    defaultOrder: Number(item.id) || 0,
  }
}

function amount(id) {
  return Number(stored.value[id] ?? stored.value[String(id)] ?? 0) || 0
}

function emitValue(next) {
  emit('update:value', props.block.id, next)
}

function set(id, val) {
  const nextAmount = isNaN(val) || val < 0 ? 0 : Math.floor(val)
  emitValue({ ...payload.value, amounts: { ...stored.value, [id]: nextAmount } })
}

function evalExpr(expr) {
  const clean = String(expr).replace(/−/g, '-').replace(/[^0-9+\-*/\s.]/g, '')
  if (!clean.trim()) return 0
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function('return (' + clean + ')')()
    return Math.abs(Math.round(result)) || 0
  } catch { return 0 }
}

function applyCalc(sign) {
  if (!canInteract.value) return
  const id = calcCoinId.value
  const amt = evalExpr(calcExpr.value)
  if (!id || !amt) return
  const next = amount(id) + amt * sign
  if (next < 0) {
    calcError.value = true
    return
  }
  set(id, next)
  calcExpr.value = ''
  calcError.value = false
}
</script>

<style scoped>
.mc-ed {display:grid;gap:var(--spacing-medium);padding-block:var(--spacing-small);--calc-key-padding-block:var(--spacing-section);--calc-display-padding-block:var(--spacing-label);--calc-pad-gap:var(--spacing-small)}
.mc-error :deep(.cp-display) {
  border-color: var(--danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--danger) 18%, transparent);
}

.mc-actions {
  display: flex;
  gap: 6px;
}

.mc-btn {
  flex: 1;
  border: none;
  border-radius: 8px;
  padding: 14px 4px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  touch-action: manipulation;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: opacity 0.12s;
}

.mc-btn:hover { opacity: 0.85; }

.mc-minus {
  color: var(--danger);
  background: color-mix(in srgb, var(--danger) 25%, transparent);
}

.mc-plus {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 25%, transparent);
}
</style>
