<template>
  <div class="application-summary">
    <div v-for="row in rolls" :key="row.label" class="application-roll">
      <DamageFormulaPreview v-if="!result" :label="row.label" :expression="row.formula" :default-color="row.color" :aria-label="row.label" />
      <template v-else><strong>{{ row.label }}</strong><DiceRollResult :result="diceResult(row.roll)" :color="row.color" :size="26" /><small>{{ row.applied }}</small></template>
    </div>
    <div v-for="effect in data.effects || []" :key="effect.id + ':' + effect.key" class="application-effect">
      <strong>{{ effect.name }}</strong>
      <span>{{ effect.duration?.formula ? `${effect.duration.formula} · ${unit(effect.duration.kind)}` : statusDuration(effect.duration) }}<template v-if="effect.concentration"> · Концентрация</template></span>
    </div>
    <p v-if="data.note" class="application-note">{{ data.note }}</p>
    <HandbookReferenceRows v-if="data.createdItems?.length" :rows="data.createdItems.map(item => ({ ...item, id: item.itemId }))">
      <template #leading="{ row }"><strong>×{{ row.count }}</strong></template>
      <template #description="{ row }"><small>Создано в рюкзаке<template v-if="row.duration"> · {{ statusDuration(row.duration) }}</template></small></template>
    </HandbookReferenceRows>
  </div>
</template>
<script setup>
import { computed, defineAsyncComponent } from 'vue'
const HandbookReferenceRows = defineAsyncComponent(() => import('@/features/items/components/HandbookReferenceRows.vue'))
import { parseDiceExpression } from '@/shared/lib/dice'
import { statusDuration } from '@/shared/lib/statusDuration'
import DiceRollResult from '@/shared/ui/DiceRollResult.vue'
import DamageFormulaPreview from '../blocks/dnd/components/DamageFormulaPreview.vue'
const props = defineProps({ data: { type: Object, default: () => ({}) }, result: Boolean })
const unit = kind => ({ rounds: 'раунды', minutes: 'минуты', hours: 'часы', days: 'дни' })[kind] || ''
const rolls = computed(() => [
  props.data.healing && { label: 'Лечение', color: 'var(--success)', formula: props.data.healing, roll: props.data.healing, applied: `Восстановлено хитов: ${props.data.healing.applied}` },
  props.data.temporaryHp && { label: 'Временные хиты', color: 'var(--info)', formula: props.data.temporaryHp, roll: props.data.temporaryHp, applied: `Прибавка временных хитов: ${props.data.temporaryHp.applied}` },
].filter(Boolean))
function diceResult(roll) {
  let offset = 0
  const parts = parseDiceExpression(roll.formula).map(part => {
    if (part.kind !== 'dice') return part
    const rolls = (roll.dice || []).slice(offset, offset + part.n); offset += part.n
    return { ...part, rolls }
  })
  return { parts, total: roll.total }
}
</script>
<style scoped>
.application-summary, .application-roll { display: grid; gap: 8px; }
.application-summary { color: var(--text-2); font-size: 13px; }
.application-effect { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 4px 12px; border-left: 2px solid var(--accent-soft); padding-left: 10px; }
.application-effect span, .application-roll small { color: var(--text-muted); font-size: 12px; }
.application-note { margin: 0; }
</style>
