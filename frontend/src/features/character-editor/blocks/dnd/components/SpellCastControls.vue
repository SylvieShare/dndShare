<template>
  <div class="spell-cast-controls">
    <template v-if="baseLevel > 0 && !entry.ref?.slotless">
      <FormField label="Круг ячейки" vertical>
        <FormSelect :value="level" aria-label="Круг ячейки" @update:value="value => level = Number(value)">
          <option v-for="option in levels" :key="option" :value="option">{{ option }} круг</option>
        </FormSelect>
      </FormField>
      <ToggleSwitch v-if="ctx.charCtx.ownerMode" v-model="spend" label="Потратить ячейку" />
      <FormField v-if="spend && pools.length > 1" label="Источник ячейки" vertical>
        <FormSelect v-model:value="pool" aria-label="Источник ячейки">
          <option v-for="option in pools" :key="option.pool" :value="option.pool">
            {{ option.pool === 'short_rest' ? 'Короткий отдых' : 'Долгий отдых' }} · {{ option.remaining }} доступно
          </option>
        </FormSelect>
      </FormField>
      <small v-if="spend && !slot" role="status">Нет доступной ячейки этого круга.</small>
      <small v-else-if="!spend">Только бросок — ячейка не расходуется.</small>
    </template>
    <small v-else-if="baseLevel > 0">{{ level }} круг · без траты ячейки</small>
    <slot :cast-level="level" :disabled="disabled" :commit="commit" :spend="spend && !entry.ref?.slotless && baseLevel > 0" />
  </div>
</template>
<script setup>
import { computed, inject, ref } from 'vue'
import { FormField, FormSelect, ToggleSwitch } from '@sylvieshare/share-ui'

const props = defineProps({ entry: { type: Object, required: true }, castLevel: Number, spendByDefault: Boolean })
const ctx = inject('spellsBlockCtx')
const baseLevel = computed(() => Number(props.entry.item?.data?.lvl) || 0)
const available = computed(() => ctx.availableSpellSlotOptions(props.entry))
const spend = ref(!!ctx.charCtx.ownerMode && props.spendByDefault && baseLevel.value > 0 && !props.entry.ref?.slotless)
const rememberedLevel = ctx.spellRollLevel(props.entry, props.castLevel)
const level = ref(props.entry.ref?.slotless ? props.castLevel : spend.value
  ? available.value.find(option => option.level === rememberedLevel)?.level || available.value[0]?.level || rememberedLevel
  : rememberedLevel)
const pool = ref('long_rest')
const levels = computed(() => Array.from({ length: 10 - baseLevel.value }, (_, index) => baseLevel.value + index))
const pools = computed(() => available.value.filter(option => option.level === level.value))
const slot = computed(() => pools.value.find(option => option.pool === pool.value) || pools.value[0])
const disabled = computed(() => ctx.spellcastingBlocked || (spend.value && (!ctx.charCtx.ownerMode || !slot.value)))

function commit() {
  if (disabled.value) return false
  if (spend.value && ctx.useSpell(props.entry, slot.value) !== true) return false
  ctx.rememberSpellRollLevel(props.entry, level.value)
  return true
}
</script>
<style scoped>
.spell-cast-controls { display: flex; flex-direction: column; gap: 8px; padding: 8px; min-width: 0; }
.spell-cast-controls > small { color: var(--text-muted); font-size: 11px; line-height: 1.4; }
</style>
