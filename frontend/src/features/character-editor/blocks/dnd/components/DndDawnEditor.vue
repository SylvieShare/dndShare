<template>
  <LoadingState v-if="loading" label="Загрузка ресурсов…" compact />
  <p v-else-if="error" role="alert">{{ error }} <ActionButton variant="quiet" @click="load">Повторить</ActionButton></p>
  <template v-else>
    <div class="dawn-resources">
      <BaseTile v-for="resource in candidates" :key="resource.key" class="dawn-resource">
        <strong>{{ resource.title }}</strong>
        <span>{{ resource.value }} / {{ resource.total }}</span>
        <small>{{ resource.dawn_recovery.mode === 'full' ? 'Восстановить полностью' : `Восстановить ${resource.dawn_recovery.formula.replace(/d/g, 'к')}` }}</small>
      </BaseTile>
      <BaseTile v-for="target in targetCandidates" :key="target.uid" class="dawn-resource"><strong>{{ target.item.name }}: {{ target.state.name }}</strong><span>{{ target.state.dawns_left }} → {{ Math.max(0, target.state.dawns_left - 1) }}</span><small>Рассветов до {{ target.state.status === 'defeated' ? 'выбора новой цели' : 'истечения срока' }}</small></BaseTile>
      <p v-if="!candidates.length && !targetCandidates.length && !done">Нет изменений на рассвете.</p>
      <BaseTile v-for="row in targetResults" :key="row.uid" class="dawn-resource"><strong>{{ row.title }}</strong><span>{{ row.before }} → {{ row.after }}</span><small>{{ row.after ? 'Осталось рассветов' : 'Можно объявить новую цель' }}</small></BaseTile>
      <BaseTile v-for="row in results" :key="row.key" class="dawn-resource">
        <strong>{{ row.title }}</strong><span>{{ row.before }} → {{ row.after }} / {{ row.total }}</span>
        <small v-if="row.formula">{{ row.formula.replace(/d/g, 'к') }}: выпало {{ row.rolled }}</small>
      </BaseTile>
    </div>
    <ActionButton v-if="!done" :disabled="(!candidates.length && !targetCandidates.length) || applying" @click="apply">Встретить рассвет</ActionButton>
    <ActionButton v-else @click="$emit('close')">Готово</ActionButton>
  </template>
</template>
<script setup>
import { computed, inject, onScopeDispose, ref, unref } from 'vue'
import { ActionButton, BaseTile, LoadingState } from '@sylvieshare/share-ui'
import { selectedTargetDawnCandidates } from '@/features/character-editor/lib/selectedTarget'
import { dawnResources, restoreDawnResources } from '@/features/character-editor/lib/dawnResources'
import { resourceItemIds } from '@/features/character-editor/lib/characterResources'
const props = defineProps({ values: Object })
const emit = defineEmits(['apply', 'close'])
const charCtx = inject('charCtx', { ownerMode: false })
const items = computed(() => unref(charCtx.characterResources?.itemsById) || new Map())
const loading = ref(true), error = ref(''), done = ref(false), applying = ref(false), results = ref([])
const targetResults = ref([])
const targetCandidates = computed(() => done.value ? [] : selectedTargetDawnCandidates(props.values, items.value))
let alive = true
const candidates = computed(() => done.value ? [] : dawnResources(props.values, items.value).filter(row => row.value < row.total))
async function load() {
  loading.value = true; error.value = ''
  try {
    await charCtx.characterResources?.ensureItems()
    if (resourceItemIds(props.values).some(id => !items.value.has(id))) throw new Error('missing')
  } catch { if (alive) error.value = 'Не удалось загрузить ресурсы персонажа.' }
  finally { if (alive) loading.value = false }
}
function apply() {
  if (!charCtx.ownerMode || done.value || applying.value) return
  applying.value = true
  const result = restoreDawnResources(props.values, items.value)
  if (result.error) { error.value = result.error; applying.value = false; return }
  targetResults.value = result.targets || []; results.value = result.results; done.value = true; applying.value = false
  emit('apply', result)
}
load()
onScopeDispose(() => { alive = false })
</script>
<style scoped>
.dawn-resources { display: grid; gap: 8px; margin-bottom: 16px; }
.dawn-resource { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 5px 12px; padding: 12px; }
.dawn-resource strong { font-size: 13px; }
.dawn-resource span { color: var(--accent-soft); font-variant-numeric: tabular-nums; }
.dawn-resource small { grid-column: 1 / -1; color: var(--text-muted); }
</style>
