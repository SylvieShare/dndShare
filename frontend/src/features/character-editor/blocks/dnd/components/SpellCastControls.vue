<template>
  <div class="spell-cast-controls">
    <template v-if="baseLevel > 0 && !entry.ref?.slotless">
      <FormField label="Круг ячейки" vertical>
        <SpellLevelSlider v-model="level" :allowed="levels" />
      </FormField>
      <ToggleSwitch v-if="ctx.charCtx.ownerMode" v-model="spend" label="Потратить ячейку" />
      <small v-if="spend && !slot" role="status">Нет доступной ячейки этого круга.</small>
    </template>
    <small v-else-if="baseLevel > 0">{{ level }} круг · без траты ячейки</small>
    <slot :cast-level="level" :disabled="disabled" :commit="commit" :spend="spend && !entry.ref?.slotless && baseLevel > 0" :pool="slot?.pool || 'long_rest'" />
  </div>
</template>
<script setup>
import SpellLevelSlider from './SpellLevelSlider.vue'
import { computed, inject, ref, watch } from 'vue'
import { FormField, ToggleSwitch } from '@sylvieshare/share-ui'

const props = defineProps({ entry: { type: Object, required: true }, castLevel: Number, spendByDefault: Boolean, application: Boolean })
const ctx = inject('spellsBlockCtx')
const baseLevel = computed(() => Number(props.entry.item?.data?.lvl) || 0)
const available = computed(() => ctx.availableSpellSlotOptions(props.entry))
const spend = ref(!!ctx.charCtx.ownerMode && props.spendByDefault && baseLevel.value > 0 && !props.entry.ref?.slotless)
const rememberedLevel = ctx.spellRollLevel(props.entry, props.castLevel)
const level = ref(props.entry.ref?.slotless ? props.castLevel : spend.value
  ? available.value.find(option => option.level === rememberedLevel)?.level || available.value[0]?.level || rememberedLevel
  : rememberedLevel)
const levels = computed(() => {
  if (props.entry.ref?.slotless) return [props.castLevel || baseLevel.value]
  if (!props.application && !spend.value) return Array.from({ length: 10 - baseLevel.value }, (_, index) => baseLevel.value + index)
  const usable = [...new Set(available.value.map(option => option.level))]
  return usable.length ? usable : !spend.value ? [baseLevel.value] : []
})
watch(levels, usable => { if (usable.length && !usable.includes(level.value)) level.value = usable[0] }, { immediate: true })
const pools = computed(() => available.value.filter(option => option.level === level.value))
const slot = computed(() => pools.value.find(option => option.pool === 'short_rest') || pools.value[0])
const disabled = computed(() => ctx.charCtx.itemTransfers?.busy || ctx.spellcastingBlocked || (spend.value && (!ctx.charCtx.ownerMode || !slot.value)))

async function commit() {
  if (disabled.value) return false
  if (spend.value && await ctx.useSpell(props.entry, slot.value) !== true) return false
  ctx.rememberSpellRollLevel(props.entry, level.value)
  return true
}
</script>
<style scoped>
.spell-cast-controls { display: flex; flex-direction: column; gap: 8px; padding: 8px; min-width: 0; }
.spell-cast-controls > small { color: var(--text-muted); font-size: 11px; line-height: 1.4; }
</style>
