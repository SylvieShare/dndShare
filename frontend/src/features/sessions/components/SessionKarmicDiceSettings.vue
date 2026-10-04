<template>
  <BaseTile class="karmic-settings">
    <h2>Кармические кубы</h2>
    <FormField label="Сглаживать серии бросков d20">
      <ToggleSwitch :model-value="settings?.enabled === true" :disabled="saving" aria-label="Кармические кубы"
        @update:model-value="emit('update-setting', 'karmicDice.enabled', $event)" />
    </FormField>
    <p>После низких значений чаще выпадают высокие, после высоких — низкие. Чем дальше значение от середины, тем сильнее меняется карма: для обычного броска 10/11 дают ±0,1, а 1/20 — ±1. Преимущество и помеха учитываются по своему распределению. Даже на краях шкалы любое значение d20 может выпасть; длинные серии становятся менее вероятными. Действует на атаки, навыки, проверки характеристик и спасброски. Бонусы и сложность проверки не влияют на шкалу; успех не гарантируется. Инициатива, урон и свободные кубики остаются случайными.</p>
    <FormField label="Учёт истории бросков">
      <ValueSelect :model-value="settings?.separate ? 'separate' : 'shared'" :options="modes" :disabled="saving"
        aria-label="Шкала кармических кубов"
        @update:model-value="emit('update-setting', 'karmicDice.separate', $event === 'separate')" />
    </FormField>
    <p>Общая шкала учитывает броски всех участников, включая существ мастера. Отдельные шкалы учитывают каждого персонажа и каждое существо независимо. Переключение режима или включения сбрасывает шкалы в центр.</p>
    <p v-if="!settings?.enabled">Выключено — все значения d20 равновероятны.</p>
    <LoadingState v-else-if="loading" label="Загружаем шкалы…" />
    <div v-else-if="error" role="alert"><p>{{ error }}</p><ActionButton size="sm" variant="quiet" @click="refresh">Повторить</ActionButton></div>
    <template v-else>
      <KarmicDiceScale v-for="scale in visibleScales" :key="scale.key" :name="scale.name" :balance="scale.balance" />
      <p v-if="settings?.enabled && settings?.separate && !scales.length">Пока бросков нет. Отдельная шкала появится после первого броска персонажа или существа.</p>
    </template>
  </BaseTile>
</template>
<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ActionButton, BaseTile, FormField, LoadingState, ToggleSwitch, ValueSelect } from '@sylvieshare/share-ui'
import { getKarmicScales } from '@/shared/api/sessionDiceApi'
import KarmicDiceScale from './KarmicDiceScale.vue'
const props = defineProps({ sessionUuid: { type: String, required: true }, settings: Object, saving: Boolean })
const emit = defineEmits(['update-setting'])
const modes = [{ value: 'shared', label: 'Общая для всех' }, { value: 'separate', label: 'Для каждого своя' }]
const scales = ref([]), loading = ref(false), error = ref('')
const visibleScales = computed(() => props.settings?.enabled && props.settings?.separate ? scales.value
  : [props.settings?.enabled && scales.value.find(row => row.key === 'shared') || { key: 'shared', name: 'Общая шкала', balance: 0 }])
let timer, generation = 0, pending = null
async function refresh(initial = false) {
  const token = generation
  if (pending === token) return
  pending = token
  if (initial) loading.value = true
  try {
    const response = await getKarmicScales(props.sessionUuid)
    if (token !== generation) return
    scales.value = response.scales
    error.value = ''
  } catch {
    if (token === generation) error.value = 'Не удалось обновить шкалы. Текущий сдвиг неизвестен.'
  } finally {
    if (pending === token) pending = null
    if (token === generation) loading.value = false
  }
}
watch([() => props.settings?.enabled, () => props.settings?.separate, () => props.sessionUuid], () => {
  clearInterval(timer)
  generation++
  scales.value = []
  error.value = ''
  if (!props.settings?.enabled) { loading.value = false; return }
  refresh(true)
  timer = setInterval(() => { if (document.visibilityState !== 'hidden') refresh() }, 3000)
}, { immediate: true })
onBeforeUnmount(() => { clearInterval(timer); generation++ })
</script>
<style scoped>
.karmic-settings { display: grid; gap: 18px; padding: 22px; }
h2 { margin: 0; font-size: 18px; }
p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; }
</style>
