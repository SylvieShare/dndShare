<template>
  <AppModalFrame v-if="ready || error" :title="item.name" subtitle="Добавление предмета" :z-index="zIndex" @close="$emit('close')">
    <p v-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="prepare">Повторить</ActionButton></p>
    <template v-else>
      <p v-if="choiceKinds.length">Основа определяет обычные характеристики предмета. Магические свойства добавляются к ним.</p>
      <DetailSection v-for="kind in choiceKinds" :key="kind" :label="kind === 'weapon' ? 'Оружейная основа' : 'Доспех или щит'">
        <MagicEquipmentBases :item="item" :kind="kind" :base-items="options[kind]" selectable :model-value="chosen[baseParamKey(kind)]" :z-index="zIndex"
          @update:model-value="chosen[baseParamKey(kind)] = $event" />
      </DetailSection>
      <InitialChargeFields v-for="stock in charges.pending.value" :key="stock.key" :model-value="charges.count(stock)" :label="stock.title" :rule="stock.rule" :title="item.name" @update:model-value="charges.counts[stock.key] = $event" />
    </template>
    <template #footer><ActionButton variant="primary" :disabled="!ready || !canConfirm" @click="confirm">{{ confirmLabel }}</ActionButton></template>
  </AppModalFrame>
  <LoadingState v-else label="Подготавливаем предмет…" compact />
</template>
<script setup>
import InitialChargeFields from './InitialChargeFields.vue'
import { useInitialChargeStocks } from '@/features/items/composables/useInitialChargeStocks'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ActionButton, AppModalFrame, LoadingState } from '@sylvieshare/share-ui'
import DetailSection from '@/shared/ui/DetailSection.vue'
import MagicEquipmentBases from './MagicEquipmentBases.vue'
import { useMagicBaseSelection } from '@/features/items/lib/useMagicBaseSelection'
import { baseParamKey } from '@/features/items/lib/magicEquipmentBases'
import { loadMagicBases } from '@/features/items/lib/loadMagicBases'
const props = defineProps({ item: Object, params: { type: Object, default: () => ({}) }, zIndex: { type: Number, default: 4700 }, confirmLabel: { type: String, default: 'Добавить предмет' } })
const emit = defineEmits(['close', 'confirm'])
const { kinds, chosen, loaded, complete, result } = useMagicBaseSelection(computed(() => props.item), props.params)
const options = ref({}), ready = ref(false), error = ref('')
const choiceKinds = computed(() => kinds.value.filter(kind => options.value[kind]?.length !== 1))
const charges = useInitialChargeStocks(computed(() => props.item), computed(() => props.params))
const needsCharges = computed(() => charges.pending.value.length > 0)
const canConfirm = computed(() => complete.value && charges.complete.value)
let alive = true
async function prepare() {
  ready.value = false; error.value = ''
  try {
    const rows = await Promise.all(kinds.value.map(async kind => [kind, await loadMagicBases(props.item, kind)]))
    if (!alive) return
    options.value = Object.fromEntries(rows)
    for (const [kind, bases] of rows) loaded(kind, bases)
    if (rows.some(([, bases]) => !bases.length)) {
      error.value = 'Подходящих основ нет. Уточните варианты у автора предмета и повторите загрузку.'
      return
    }
    if (complete.value && !choiceKinds.value.length && !needsCharges.value) confirm()
    else ready.value = true
  } catch { if (alive) error.value = 'Не удалось загрузить основы предмета.' }
}
function confirm() {
  if (!canConfirm.value) return
  const params = { ...props.params, ...result() }
  emit('confirm', charges.result(params))
}
onMounted(prepare)
onBeforeUnmount(() => { alive = false })
</script>
