<template>
  <BaseTile
    class="money-tile"
    :interactive="canInteract"
    @click="canInteract && open($event)"
  >
    <BlockMoneyView :title="blockTitle" :loading="loading" :coins="displayCoins" />
  </BaseTile>

  <MorphEditorShell
    v-if="editorOpen"
    :origin-rect="originRect"
    :origin-el="originEl"
    orientation="vertical"
    :strip="false"
    :view-width="300"
    @close="closeEditor"
  >
    <template #view>
      <div class="money-face">
        <BlockMoneyView :title="blockTitle" :loading="loading" :coins="displayCoins" />
      </div>
    </template>

    <template #editor>
      <EditorPanel compact class="mc-ed" :class="{ 'mc-error': calcError }">
        <CalcPad v-model="calcExpr">
          <template #append>
            <button ref="coinTriggerEl" type="button" class="mc-coin-trigger" @click="coinPickerOpen = !coinPickerOpen">
              <span v-if="selectedCoin?.iconUrl" class="mc-coin-icon" v-html="selectedCoin.iconUrl" aria-hidden="true" />
              <span v-else-if="selectedCoin" class="mc-coin-dot" :style="{ background: selectedCoin.color }" />
              <span class="mc-coin-name">{{ selectedCoin?.title || '—' }}</span>
              <svg class="mc-coin-chevron" viewBox="0 0 10 6" fill="none" width="10" height="6">
                <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </template>
        </CalcPad>
        <div class="mc-actions">
          <button class="mc-btn mc-minus" type="button" @click="applyCalc(-1)">Дать</button>
          <button class="mc-btn mc-plus" type="button" @click="applyCalc(1)">Взять</button>
        </div>
      </EditorPanel>
    </template>
  </MorphEditorShell>

  <BasePopover
    :open="coinPickerOpen"
    :anchor="coinTriggerEl"
    placement="bottom-end"
    :z-index="1100"
    @update:open="coinPickerOpen = $event"
  >
    <template #default="{ close: closePicker }">
      <button
        v-for="coin in coins"
        :key="coin.id"
        type="button"
        class="mc-coin-option"
        :class="{ active: String(coin.id) === calcCoinId }"
        @click="calcCoinId = String(coin.id); closePicker()"
      >
        <span v-if="coin.iconUrl" class="mc-coin-icon" v-html="coin.iconUrl" aria-hidden="true" />
        <span v-else class="mc-coin-dot" :style="{ background: coin.color }" />
        <span>{{ coin.title }}</span>
      </button>
    </template>
  </BasePopover>
</template>

<script setup>
import { computed, inject, ref, watch } from 'vue'
import { BasePopover } from '@sylvieshare/share-ui'
import { BaseTile } from '@sylvieshare/share-ui'
import BlockMoneyView from '@/features/character-editor/blocks/generic/components/BlockMoneyView'
import CalcPad from '@/features/character-editor/components/CalcPad'
import { EditorPanel } from '@sylvieshare/share-ui'
import MorphEditorShell from '@/features/character-editor/components/MorphEditorShell'
import { useMorphOrigin } from '@/features/character-editor/composables/useMorphOrigin'
import { useSuggestStore } from '@/stores/suggest'

const props = defineProps(['block', 'value'])
const emit = defineEmits(['update:value'])
const charCtx = inject('charCtx', { ownerMode: false })
const { editorOpen, originRect, originEl, open, close } = useMorphOrigin()

const loading = ref(false)
const calcExpr = ref('')
const calcCoinId = ref('')
const calcError = ref(false)
const coinPickerOpen = ref(false)
const coinTriggerEl = ref(null)

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
  iconUrl: coin.iconUrl,
  color: coin.color,
  amount: amount(coin.id),
})))

const selectedCoin = computed(() => coins.value.find(c => String(c.id) === calcCoinId.value) ?? null)

const canInteract = computed(() => charCtx.ownerMode)

watch(suggestTypeId, () => { loadCoins() }, { immediate: true })
watch(coins, (list) => {
  if (!calcCoinId.value && list.length) calcCoinId.value = String(list[0].id)
}, { immediate: true })

function closeEditor() {
  coinPickerOpen.value = false
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
    color: item.color || '#cccccc',
    iconUrl: item.svg || '',
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
.money-tile {
  min-width: 0;
  padding: 12px 14px;
}

/* morph view (top column) — match the tile's padding so it doesn't jump during the morph */
.money-face {
  padding: 12px 14px;
}

/* editor */
.mc-coin-trigger {
  display: inline-flex;
  flex: 0 0 112px;
  width: 112px;
  min-width: 0;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: color-mix(in srgb, var(--surface-raised) 42%, var(--bg));
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.15s;
}

.mc-coin-trigger:hover,
.mc-coin-trigger:focus-visible {
  border-color: var(--accent);
  outline: none;
}

.mc-coin-icon {
  width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.mc-coin-icon :deep(svg) { width: 16px; height: 16px; }

.mc-coin-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.mc-coin-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mc-coin-chevron {
  color: var(--text-muted);
  flex-shrink: 0;
  margin-left: 2px;
}

.mc-coin-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s, color 0.12s;
}

.mc-coin-option:hover {
  background: var(--border);
  color: var(--text-1);
}

.mc-coin-option.active {
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}

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
