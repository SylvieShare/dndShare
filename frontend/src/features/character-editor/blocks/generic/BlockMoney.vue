<template>
  <BlockMoneyView v-bind="$attrs" ref="tileRef" class="money-tile"
    :inline="inline" :title="blockTitle" :loading="loading" :coins="displayCoins"
    :interactive="canInteract" :editable="canInteract"
    @click="canInteract && open($event)" @edit="openFrom(tileRef?.$el)"
  />

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    orientation="vertical"
    :strip="false"
    :view-width="moneyViewWidth"
    @close="closeEditor"
  >
    <template #view="{ revealed }">
      <MoneyMorphPreview v-if="inline" :origin-el="originEl" :origin-rect="originRect" :revealed="revealed"
        :view-width="moneyViewWidth" :loading="loading" :coins="displayCoins" />
      <BlockMoneyView v-else panel :title="blockTitle" :loading="loading" :coins="displayCoins" />
    </template>

    <template #editor>
      <EditorPanel compact class="mc-ed" :class="{ 'mc-error': calcError }">
        <CalcPad v-model="calcExpr">
          <template #display-trailing>
            <MoneyCurrencyPicker v-model="calcCoinId" :coins="coins" />
          </template>
        </CalcPad>
        <div class="mc-actions">
          <button class="mc-btn mc-minus" type="button" @click="applyCalc(-1)">Дать</button>
          <button class="mc-btn mc-plus" type="button" @click="applyCalc(1)">Взять</button>
        </div>
      </EditorPanel>
    </template>
  </MorphEditorShell>

</template>

<script setup>
defineOptions({ inheritAttrs: false })
import { computed, inject, ref, watch } from 'vue'
import BlockMoneyView from '@/features/character-editor/blocks/generic/components/BlockMoneyView'
import MoneyMorphPreview from './components/MoneyMorphPreview.vue'
import CalcPad from '@/features/character-editor/components/CalcPad'
import { EditorPanel } from '@sylvieshare/share-ui'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSuggestStore } from '@/stores/suggest'
import MoneyCurrencyPicker from './components/MoneyCurrencyPicker.vue'

const props = defineProps({ block: Object, value: { default: null }, inline: Boolean })
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const tileRef = ref(null)
const { editorOpen, originRect, originEl, open, openFrom, close } = useMorphOrigin()
const moneyViewWidth = computed(() => props.inline ? Math.max(300, (originRect.value?.width || 0) + 2) : 300)

const loading = ref(false)
const calcExpr = ref('')
const calcCoinId = ref('')
const calcError = ref(false)

const blockTitle = computed(() => props.block.props?.title || props.block.content?.title || '')
const suggestTypeId = computed(() => props.block.content?.suggest_type_id)
const items = computed(() => useSuggestStore().items(suggestTypeId.value) || [])

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

// flattened for BlockMoneyView (tile + morph share it): inject the resolved amount per coin
const displayCoins = computed(() => [...nonZero.value].reverse().map(coin => ({
  id: coin.id,
  title: coin.title,
  iconImageUrl: coin.iconImageUrl,
  svg: coin.svg,
  color: coin.color,
  amount: amount(coin.id),
})))

const canInteract = computed(() => charCtx.ownerMode)

watch(suggestTypeId, () => { loadCoins() }, { immediate: true })
watch(coins, (list) => {
  if (!calcCoinId.value && list.length) calcCoinId.value = String(list[0].id)
}, { immediate: true })

function closeEditor() {
  calcExpr.value = ''
  calcError.value = false
  close()
}

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
